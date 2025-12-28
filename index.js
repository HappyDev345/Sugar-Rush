require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, 
    TextInputStyle, PermissionsBitField, REST, Routes, ActivityType 
} = require('discord.js');
const mongoose = require('mongoose');

// --- 1. CONFIGURATION ---
const BOT_TOKEN = process.env.DISCORD_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

const BRAND_NAME = "Sugar Rush";
const BRAND_COLOR = 0xFFA500; // Orange
const SUPPORT_SERVER_LINK = "https://discord.gg/ceT3Gqwquj";
const SUPPORT_SERVER_ID = '1454857011866112063';

// --- IDs ---
const ROLES = {
    COOK: '1454877400729911509',
    DELIVERY: '1454877287953469632',
    MANAGER: '1454876343878549630',
    OWNER: '662655499811946536',
    SENIOR_COOK: '0', 
    SENIOR_DELIVERY: '0',
    BYPASS: '1454936082591252534',
    VIP: '1454935878408605748'
};

const CHANNELS = {
    COOK: '1454879418999767122',
    DELIVERY: '1454880879741767754',
    WARNING: '1454881451161026637',
    VACATION: '1454909580894015754',
    BACKUP: '1454888266451910901',
    RATINGS: '1454884136740327557',
    COMPLAINT: '1454886383662665972',
    QUOTA: '1454895987322519672'
};

// --- 2. DATABASE SCHEMAS ---
const orderSchema = new mongoose.Schema({
    order_id: String,
    user_id: String,
    guild_id: String,
    channel_id: String,
    status: { type: String, default: 'pending' },
    item: String,
    is_vip: Boolean,
    created_at: { type: Date, default: Date.now },
    chef_name: String,
    deliverer_id: String,
    claimed_at: Date,
    ready_at: Date,
    images: [String],
    rating: Number,
    backup_msg_id: String
});

const userSchema = new mongoose.Schema({
    user_id: String,
    cook_count_week: { type: Number, default: 0 },
    cook_count_total: { type: Number, default: 0 },
    deliver_count_week: { type: Number, default: 0 },
    deliver_count_total: { type: Number, default: 0 },
    quota_fails_cook: { type: Number, default: 0 },
    quota_fails_deliver: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    is_banned: { type: Number, default: 0 },
    ban_expires_at: Date
});

const premiumSchema = new mongoose.Schema({
    user_id: String,
    is_vip: Boolean,
    expires_at: Date
});

const codeSchema = new mongoose.Schema({
    code: String,
    status: { type: String, default: 'unused' },
    created_by: String
});

const vacationSchema = new mongoose.Schema({
    user_id: String,
    status: String,
    end_date: Date
});

const scriptSchema = new mongoose.Schema({
    user_id: String,
    script: String
});

const configSchema = new mongoose.Schema({
    key: String,
    date: Date
});

const Order = mongoose.model('Order', orderSchema);
const User = mongoose.model('User', userSchema);
const PremiumUser = mongoose.model('PremiumUser', premiumSchema);
const PremiumCode = mongoose.model('PremiumCode', codeSchema);
const Vacation = mongoose.model('Vacation', vacationSchema);
const Script = mongoose.model('Script', scriptSchema);
const Config = mongoose.model('Config', configSchema);

// --- 3. CLIENT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences
    ],
    partials: [Partials.Channel]
});

// --- 4. HELPER FUNCTIONS ---
const isStaff = (member) => {
    if (!member) return false;
    const r = member.roles.cache;
    return r.has(ROLES.COOK) || r.has(ROLES.DELIVERY) || r.has(ROLES.MANAGER) || member.id === ROLES.OWNER;
};

const updateMasterLog = async (orderId) => {
    try {
        const channel = await client.channels.fetch(CHANNELS.BACKUP).catch(() => null);
        if (!channel) return;
        const o = await Order.findOne({ order_id: orderId });
        if (!o) return;

        const embed = new EmbedBuilder()
            .setTitle(`🍩 Order #${o.order_id}`)
            .setColor(BRAND_COLOR)
            .addFields(
                { name: 'Status', value: o.status.toUpperCase(), inline: true },
                { name: 'Item', value: o.item, inline: true },
                { name: 'Client', value: `<@${o.user_id}>`, inline: true },
                { name: 'Chef', value: o.chef_name || 'None', inline: true }
            );

        if (!o.backup_msg_id) {
            const msg = await channel.send({ embeds: [embed] });
            o.backup_msg_id = msg.id;
            await o.save();
        } else {
            const msg = await channel.messages.fetch(o.backup_msg_id).catch(() => null);
            if (msg) await msg.edit({ embeds: [embed] });
        }
    } catch (e) { console.error(e); }
};

const generateCode = () => `VIP-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

// --- 5. EVENTS ---

client.once('clientReady', async () => {
    console.log(`🚀 ${BRAND_NAME} is ONLINE as ${client.user.tag}`);
    client.user.setPresence({ activities: [{ name: '/order | Sugar Rush', type: ActivityType.Playing }], status: 'online' });

    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");
    } catch (e) { console.error("❌ MongoDB Error:", e); }

    // Register Commands
    const commands = [
        { name: 'order', description: 'Order food', options: [{ name: 'item', type: 3, required: true, description: 'Item' }] },
        { name: 'claim', description: 'Claim order', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },
        { 
            name: 'cook', 
            description: 'Cook order', 
            options: [
                { name: 'id', type: 3, required: true, description: 'ID' }, 
                { name: 'image', type: 11, required: true, description: 'Proof 1' },
                { name: 'image2', type: 11, required: false, description: 'Proof 2' },
                { name: 'image3', type: 11, required: false, description: 'Proof 3' }
            ] 
        },
        { name: 'deliver', description: 'Deliver order', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },
        { name: 'setscript', description: 'Set delivery message', options: [{ name: 'message', type: 3, required: true, description: 'Script' }] },
        { name: 'invite', description: 'Get invite link' },
        { name: 'warn', description: 'Warn user', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },
        { name: 'fdo', description: 'Force delete order', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },
        { name: 'unban', description: 'Unban user', options: [{ name: 'user', type: 6, required: true, description: 'User' }] },
        { name: 'rules', description: 'View rules' },
        { name: 'generate_codes', description: 'Owner: Gen Codes', options: [{ name: 'amount', type: 4, required: true, description: 'Amount' }] },
        { name: 'redeem', description: 'Redeem VIP', options: [{ name: 'code', type: 3, required: true, description: 'Code' }] },
        { name: 'vacation', description: 'Request vacation', options: [{ name: 'days', type: 4, required: true, description: 'Days' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },
        { name: 'quota', description: 'Check your current quota status' },
        { name: 'stats', description: 'Check staff stats (Rating, Totals)', options: [{ name: 'user', type: 6, required: false, description: 'User' }] },
        { name: 'rate', description: 'Rate service', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'stars', type: 4, required: true, description: '1-5' }] },
        { name: 'complain', description: 'Complaint', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },
        { name: 'orderlist', description: 'View queue' },
        { name: 'unclaim', description: 'Drop order', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },
        { name: 'runquota', description: 'Manager: Force Run Quota' }
    ];

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); } catch (e) { console.error(e); }
    
    setInterval(checkTasks, 60000);
});

// --- 6. AUTOMATED SYSTEMS ---

async function checkTasks() {
    // 1. Auto Delivery
    const threshold = new Date(Date.now() - 20 * 60000);
    const overdue = await Order.find({ status: 'ready', ready_at: { $lt: threshold } });
    for (const o of overdue) {
        try {
            const guild = client.guilds.cache.get(o.guild_id);
            if (guild) {
                const channel = guild.channels.cache.get(o.channel_id);
                if (channel) {
                    let imgStr = o.images.join('\n');
                    await channel.send(`<@${o.user_id}> 🤖 **Auto-Delivery**\nChef: ${o.chef_name}\n${imgStr}`);
                    o.status = 'delivered';
                    o.deliverer_id = 'AUTO_BOT';
                    await o.save();
                    updateMasterLog(o.order_id);
                }
            }
        } catch(e) {}
    }

    // 2. Weekly Quota Check (Sunday 23:00 UTC)
    const now = new Date();
    if (now.getUTCDay() === 0 && now.getUTCHours() === 23) {
        const lastRun = await Config.findOne({ key: 'last_quota_run' });
        const twelveHours = 12 * 60 * 60 * 1000;
        if (!lastRun || (now - lastRun.date) > twelveHours) {
            for (const [id, guild] of client.guilds.cache) {
                await runQuotaLogic(guild);
            }
            await Config.findOneAndUpdate({ key: 'last_quota_run' }, { date: now }, { upsert: true });
        }
    }
}

// --- QUOTA LOGIC ---
const calculateTargets = (volume, staffCount) => {
    if (staffCount === 0) return { norm: 0, senior: 0 };
    let raw = Math.ceil(volume / staffCount);
    let norm = Math.min(raw, 30);
    let senior = Math.ceil(norm / 2);
    if (volume > 0) {
        norm = Math.max(1, norm);
        senior = Math.max(1, senior);
    }
    return { norm, senior };
};

async function runQuotaLogic(guild) {
    const quotaChannel = guild.channels.cache.get(CHANNELS.QUOTA);
    if (!quotaChannel) return;

    const cookRole = guild.roles.cache.get(ROLES.COOK);
    const delRole = guild.roles.cache.get(ROLES.DELIVERY);
    if(!cookRole || !delRole) return;
    await guild.members.fetch(); 

    const cooks = cookRole.members.map(m => m);
    const deliverers = delRole.members.map(m => m);

    const allUsers = await User.find({});
    let totalCook = 0;
    let totalDel = 0;
    
    for (const m of cooks) {
        const u = allUsers.find(u => u.user_id === m.id);
        if(u) totalCook += u.cook_count_week;
    }
    for (const m of deliverers) {
        const u = allUsers.find(u => u.user_id === m.id);
        if(u) totalDel += u.deliver_count_week;
    }

    const cTarget = calculateTargets(totalCook, cooks.length);
    const dTarget = calculateTargets(totalDel, deliverers.length);

    let report = `📊 **Weekly Quota Report**\n`;
    report += `🍩 Total Cooked: ${totalCook} | 🚴 Total Delivered: ${totalDel}\n`;
    report += `**Targets:** Normal \`${cTarget.norm}\` | Senior \`${cTarget.senior}\`\n\n`;

    // Cooks
    report += `__**👨‍🍳 Kitchen Staff**__\n`;
    for (const m of cooks) {
        const u = await User.findOne({ user_id: m.id }) || new User({ user_id: m.id });
        const isSenior = m.roles.cache.has(ROLES.SENIOR_COOK);
        const target = isSenior ? cTarget.senior : cTarget.norm;
        const done = u.cook_count_week;
        const isBypass = m.roles.cache.has(ROLES.BYPASS);

        if (isBypass) {
            report += `🛡️ <@${m.id}>: Exempt (Vacation/Bypass)\n`;
        } else if (done >= target) {
            u.quota_fails_cook = 0;
            report += `✅ <@${m.id}>: ${done}/${target} (Passed)\n`;
        } else {
            u.quota_fails_cook += 1;
            if (u.quota_fails_cook >= 2) {
                m.roles.remove(ROLES.COOK).catch(()=>{});
                u.quota_fails_cook = 0;
                report += `❌ <@${m.id}>: ${done}/${target} (**ROLE REMOVED** - 2nd Strike)\n`;
            } else {
                report += `⚠️ <@${m.id}>: ${done}/${target} (Strike ${u.quota_fails_cook}/2)\n`;
            }
        }
        u.cook_count_week = 0;
        await u.save();
    }

    // Delivery
    report += `\n__**🚴 Delivery Staff**__\n`;
    for (const m of deliverers) {
        const u = await User.findOne({ user_id: m.id }) || new User({ user_id: m.id });
        const isSenior = m.roles.cache.has(ROLES.SENIOR_DELIVERY);
        const target = isSenior ? dTarget.senior : dTarget.norm;
        const done = u.deliver_count_week;
        const isBypass = m.roles.cache.has(ROLES.BYPASS);

        if (isBypass) {
            report += `🛡️ <@${m.id}>: Exempt (Vacation/Bypass)\n`;
        } else if (done >= target) {
            u.quota_fails_deliver = 0;
            report += `✅ <@${m.id}>: ${done}/${target} (Passed)\n`;
        } else {
            u.quota_fails_deliver += 1;
            if (u.quota_fails_deliver >= 2) {
                m.roles.remove(ROLES.DELIVERY).catch(()=>{});
                u.quota_fails_deliver = 0;
                report += `❌ <@${m.id}>: ${done}/${target} (**ROLE REMOVED** - 2nd Strike)\n`;
            } else {
                report += `⚠️ <@${m.id}>: ${done}/${target} (Strike ${u.quota_fails_deliver}/2)\n`;
            }
        }
        u.deliver_count_week = 0;
        await u.save();
    }

    if (report.length > 2000) {
        const chunks = report.match(/[\s\S]{1,2000}/g) || [];
        for (const chunk of chunks) await quotaChannel.send(chunk);
    } else {
        await quotaChannel.send(report);
    }
}

// --- 7. INTERACTIONS ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    // --- ORDER ---
    if (commandName === 'order') {
        const item = interaction.options.getString('item');
        const oid = Math.random().toString(36).substring(2, 8).toUpperCase();
        const u = await User.findOne({ user_id: interaction.user.id });
        if(u && u.is_banned) return interaction.reply({content: '🛑 Banned.', ephemeral: true});
        const active = await Order.findOne({ user_id: interaction.user.id, status: { $in: ['pending', 'claimed', 'cooking', 'ready'] } });
        if (active) return interaction.reply({ content: "❌ You already have an active order.", ephemeral: true });

        const vipUser = await PremiumUser.findOne({ user_id: interaction.user.id, is_vip: true });
        const isVip = !!vipUser;

        await new Order({
            order_id: oid, user_id: interaction.user.id, guild_id: interaction.guild.id,
            channel_id: interaction.channel.id, item: item, is_vip: isVip
        }).save();

        updateMasterLog(oid);
        const channel = client.channels.cache.get(CHANNELS.COOK);
        if(channel) {
            const ping = isVip ? "@here" : "";
            const emoji = isVip ? "💎 **VIP ORDER!**" : "🍩 **New Order!**";
            channel.send(`${ping} ${emoji} \`${oid}\`\nUser: <@${interaction.user.id}>\nItem: **${item}**`);
        }
        await interaction.reply({ content: `✅ Order \`${oid}\` placed!`, ephemeral: true });
    }

    // --- CLAIM ---
    if (commandName === 'claim') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
        const oid = interaction.options.getString('id');
        const order = await Order.findOne({ order_id: oid });
        if(!order || order.status !== 'pending') return interaction.reply({content: '❌ Invalid.', ephemeral: true});
        order.status = 'claimed';
        order.chef_name = interaction.user.username;
        await order.save();
        updateMasterLog(oid);
        try { (await client.users.fetch(order.user_id)).send(`👨‍🍳 Chef **${interaction.user.username}** claimed order \`${oid}\`.`); } catch(e){}
        await interaction.reply(`👨‍🍳 Claimed \`${oid}\`.`);
    }

    // --- COOK ---
    if (commandName === 'cook') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
        const oid = interaction.options.getString('id');
        const img1 = interaction.options.getAttachment('image');
        const img2 = interaction.options.getAttachment('image2');
        const img3 = interaction.options.getAttachment('image3');
        const order = await Order.findOne({ order_id: oid });
        if(!order || order.status !== 'claimed') return interaction.reply({content: '❌ Invalid.', ephemeral: true});
        
        order.status = 'ready'; order.ready_at = new Date(); order.images = [img1.url];
        if(img2) order.images.push(img2.url); if(img3) order.images.push(img3.url);
        await order.save();
        
        await User.findOneAndUpdate({ user_id: interaction.user.id }, { $inc: { cook_count_week: 1, cook_count_total: 1 } }, { upsert: true });
        updateMasterLog(oid);
        const dc = client.channels.cache.get(CHANNELS.DELIVERY);
        if(dc) dc.send(`📦 **Ready!** \`${oid}\`\nChef: ${interaction.user.username}\nUse \`/deliver ${oid}\``);
        try { (await client.users.fetch(order.user_id)).send(`📦 Order \`${oid}\` is cooked! Waiting for driver.`); } catch(e){}
        await interaction.reply(`✅ Cooked \`${oid}\`.`);
    }

    // --- SET SCRIPT ---
    if (commandName === 'setscript') {
        const msg = interaction.options.getString('message');
        await Script.findOneAndUpdate({ user_id: interaction.user.id }, { script: msg }, { upsert: true });
        await interaction.reply({ content: "✅ Script saved.", ephemeral: true });
    }

    // --- DELIVER ---
    if (commandName === 'deliver') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
        const oid = interaction.options.getString('id');
        const order = await Order.findOne({ order_id: oid });
        if(!order || order.status !== 'ready') return interaction.reply({content: '❌ Not ready.', ephemeral: true});

        const scriptDoc = await Script.findOne({ user_id: interaction.user.id });
        const script = scriptDoc ? scriptDoc.script : "Here is your order! 🍩";
        const guild = client.guilds.cache.get(order.guild_id);
        const channel = guild?.channels.cache.get(order.channel_id);
        
        if(channel) {
            await channel.send(`<@${order.user_id}> 🚴 **Order Delivered!**\nChef: ${order.chef_name}\n**Message:** ${script}\n${order.images.join('\n')}`);
            order.status = 'delivered'; await order.save();
            await User.findOneAndUpdate({ user_id: interaction.user.id }, { $inc: { deliver_count_week: 1, deliver_count_total: 1 } }, { upsert: true });
            updateMasterLog(oid);
            await interaction.reply({content: '✅ Delivered!', ephemeral: true});
        } else {
            await interaction.reply({content: '❌ Could not reach channel.', ephemeral: true});
        }
    }

    // --- QUOTA COMMAND (UPDATED) ---
    if (commandName === 'quota') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
        
        const guild = interaction.guild;
        const cookRole = guild.roles.cache.get(ROLES.COOK);
        const delRole = guild.roles.cache.get(ROLES.DELIVERY);
        await guild.members.fetch(); 
        const cooks = cookRole ? cookRole.members.size : 1;
        const deliverers = delRole ? delRole.members.size : 1;

        // Calculate Dynamic Targets Live
        const allUsers = await User.find({});
        let totalCook = 0; let totalDel = 0;
        allUsers.forEach(u => { totalCook += u.cook_count_week; totalDel += u.deliver_count_week; });

        const cTarget = calculateTargets(totalCook, cooks);
        const dTarget = calculateTargets(totalDel, deliverers);

        const u = await User.findOne({ user_id: interaction.user.id }) || {};
        const isCook = interaction.member.roles.cache.has(ROLES.COOK);
        const isDel = interaction.member.roles.cache.has(ROLES.DELIVERY);
        
        let msg = `📊 **Current Quota Status**\n`;
        if (isCook) {
            const target = interaction.member.roles.cache.has(ROLES.SENIOR_COOK) ? cTarget.senior : cTarget.norm;
            const status = (u.cook_count_week >= target) ? "✅" : "⚠️";
            msg += `👨‍🍳 Cooking: **${u.cook_count_week || 0} / ${target}** ${status}\n`;
        }
        if (isDel) {
            const target = interaction.member.roles.cache.has(ROLES.SENIOR_DELIVERY) ? dTarget.senior : dTarget.norm;
            const status = (u.deliver_count_week >= target) ? "✅" : "⚠️";
            msg += `🚴 Delivery: **${u.deliver_count_week || 0} / ${target}** ${status}\n`;
        }
        await interaction.reply({ content: msg, ephemeral: true });
    }

    // --- STATS COMMAND (UPDATED) ---
    if (commandName === 'stats') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Staff only.', ephemeral: true });
        
        const target = interaction.options.getUser('user') || interaction.user;
        const u = await User.findOne({ user_id: target.id }) || {};
        
        // Calculate Rating
        const ratedOrders = await Order.find({ deliverer_id: target.id, rating: { $exists: true } });
        let avgRating = "N/A";
        if (ratedOrders.length > 0) {
            const sum = ratedOrders.reduce((a, b) => a + b.rating, 0);
            avgRating = (sum / ratedOrders.length).toFixed(1) + " ⭐";
        }

        const embed = new EmbedBuilder()
            .setTitle(`📈 Stats: ${target.username}`)
            .setColor(0x9b59b6)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: "👨‍🍳 Cooking", value: `Weekly: ${u.cook_count_week || 0}\nLifetime: ${u.cook_count_total || 0}`, inline: true },
                { name: "🚴 Delivery", value: `Weekly: ${u.deliver_count_week || 0}\nLifetime: ${u.deliver_count_total || 0}`, inline: true },
                { name: "⭐ Rating", value: avgRating, inline: false }
            );
        await interaction.reply({ embeds: [embed] });
    }
    
    // --- RATE ---
    if (commandName === 'rate') {
        const oid = interaction.options.getString('id');
        const stars = interaction.options.getInteger('stars');
        const order = await Order.findOne({ order_id: oid, user_id: interaction.user.id });
        
        if(!order || order.status !== 'delivered') return interaction.reply({content: "❌ Not delivered.", ephemeral: true});
        
        order.rating = stars;
        await order.save();
        updateMasterLog(oid);

        const chan = client.channels.cache.get(CHANNELS.RATINGS);
        if(chan) chan.send(`${"⭐".repeat(stars)} **Rating!** \`${oid}\`\nChef: ${order.chef_name}\nDeliverer: <@${order.deliverer_id}>`);
        await interaction.reply({content: "Thank you!", ephemeral: true});
    }

    // --- OTHER STANDARD COMMANDS ---
    if (commandName === 'invite') {
        const link = client.generateInvite({ 
            scopes: ['bot', 'applications.commands'], 
            permissions: [
                PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.UseExternalEmojis, PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.CreateInstantInvite
            ] 
        });
        await interaction.reply({ content: `🔗 **Invite Me:** [Click Here](${link})`, ephemeral: true });
    }
    if (commandName === 'generate_codes') {
        if(interaction.user.id !== ROLES.OWNER) return interaction.reply('❌ Owner only.');
        const amount = interaction.options.getInteger('amount');
        let txt = ""; for(let i=0; i<amount; i++) { const c = generateCode(); await new PremiumCode({ code: c, created_by: interaction.user.id }).save(); txt += c + "\n"; }
        await interaction.reply({ files: [{ attachment: Buffer.from(txt), name: 'codes.txt' }], ephemeral: true });
    }
    if (commandName === 'redeem') {
        const code = interaction.options.getString('code');
        const valid = await PremiumCode.findOneAndUpdate({ code: code, status: 'unused' }, { status: 'redeemed' });
        if(!valid) return interaction.reply({content: '❌ Invalid code.', ephemeral: true});
        await PremiumUser.findOneAndUpdate({ user_id: interaction.user.id }, { is_vip: true, expires_at: new Date(Date.now() + 30*24*60*60*1000) }, { upsert: true });
        try { (await client.guilds.cache.get(SUPPORT_SERVER_ID).members.fetch(interaction.user.id)).roles.add(ROLES.VIP); } catch(e){}
        await interaction.reply({content: '💎 **VIP Redeemed!**', ephemeral: true});
    }
    if (commandName === 'orderlist') {
        const active = await Order.find({ status: { $in: ['pending', 'claimed', 'cooking', 'ready'] } }).sort({ is_vip: -1, created_at: 1 });
        let msg = "**🍩 Queue:**\n"; if (active.length === 0) msg = "Queue empty.";
        active.forEach(o => { const vip = o.is_vip ? "💎" : ""; msg += `${vip}\`${o.order_id}\`: **${o.status.toUpperCase()}** (${o.item})\n`; });
        await interaction.reply({ content: msg.substring(0, 2000), ephemeral: true });
    }
    if (commandName === 'unclaim') {
        const oid = interaction.options.getString('id');
        const order = await Order.findOne({ order_id: oid });
        if(!order || order.status !== 'claimed') return interaction.reply({content: '❌ Not claimed.', ephemeral: true});
        if(order.chef_name !== interaction.user.username && !isManager(interaction.member)) return interaction.reply({content: '❌ Not yours.', ephemeral: true});
        order.status = 'pending'; order.chef_name = null; await order.save(); updateMasterLog(oid); await interaction.reply(`🔓 Unclaimed \`${oid}\`.`);
    }
    if (commandName === 'warn' || commandName === 'fdo') {
        if(!isManager(interaction.member)) return interaction.reply({content: '❌ Managers only.', ephemeral: true});
        const oid = interaction.options.getString('id'); const reason = interaction.options.getString('reason');
        const order = await Order.findOne({ order_id: oid }); if(!order) return interaction.reply("❌ Invalid.");
        order.status = commandName === 'fdo' ? 'cancelled_fdo' : 'cancelled_warn'; await order.save(); updateMasterLog(oid);
        const u = await User.findOneAndUpdate({ user_id: order.user_id }, { $inc: { warnings: 1 } }, { new: true, upsert: true });
        if(u.warnings >= 3) { u.is_banned = 1; await u.save(); }
        await interaction.reply(`Action taken. Strikes: ${u.warnings}`);
    }
    if (commandName === 'runquota') {
        if(!interaction.member.roles.cache.has(ROLES.MANAGER) && interaction.user.id !== ROLES.OWNER) return interaction.reply({ content: '❌ Manager only.', ephemeral: true});
        await interaction.deferReply({ ephemeral: true }); await runQuotaLogic(interaction.guild); await interaction.editReply("✅ Quota run forced.");
    }
    if (commandName === 'rules') {
        const embed = new EmbedBuilder().setTitle(`${BRAND_NAME} Rules`).setColor(BRAND_COLOR).addFields({ name: "1. The Golden Rule", value: "**Every order MUST include a donut.**" }, { name: "2. Conduct", value: "No NSFW." }, { name: "3. Queue", value: "1 Active order at a time." }, { name: "4. Max Items", value: "3 Items per order." });
        await interaction.reply({ embeds: [embed] });
    }
    if (commandName === 'complain') {
        const oid = interaction.options.getString('id'); const reason = interaction.options.getString('reason');
        const order = await Order.findOne({ order_id: oid }); if(!order) return interaction.reply("❌ Invalid.");
        const chan = client.channels.cache.get(CHANNELS.COMPLAINT); if(chan) chan.send(`🚨 **Complaint** \`${oid}\`\nUser: <@${interaction.user.id}>\nReason: ${reason}`);
        await interaction.reply({content: "Sent.", ephemeral: true});
    }
    if (commandName === 'unban') {
        if(!isManager(interaction.member)) return interaction.reply({content: '❌ Managers only.', ephemeral: true});
        const target = interaction.options.getUser('user');
        await User.findOneAndUpdate({ user_id: target.id }, { is_banned: 0, warnings: 0 });
        await interaction.reply(`✅ Unbanned ${target.username}.`);
    }
});

client.login(BOT_TOKEN);
