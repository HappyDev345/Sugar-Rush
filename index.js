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
const SUPPORT_EMAIL = "help@sugarrush.gg";

// --- IDs ---
const ROLES = {
    COOK: '1454877400729911509',
    DELIVERY: '1454877287953469632',
    MANAGER: '1454876343878549630',
    OWNER: '662655499811946536',
    SENIOR_COOK: '0', // Placeholder
    SENIOR_DELIVERY: '0', // Placeholder
    BYPASS: '1454936082591252534',
    VIP: '1454935878408605748'
};

const CHANNELS = {
    COOK: '1454879418999767122',
    DELIVERY: '1454880879741767754',
    WARNING: '1454881451161026637',
    RATINGS: '1454884136740327557',
    COMPLAINT: '1454886383662665972',
    BACKUP: '1454888266451910901',
    QUOTA: '1454895987322519672',
    VACATION: '1454909580894015754'
};

const SUPPORT_SERVER_ID = '1454857011866112063';

// --- 2. DATABASE SCHEMAS ---
const orderSchema = new mongoose.Schema({
    order_id: String,
    user_id: String,
    guild_id: String,
    channel_id: String,
    status: { type: String, default: 'pending' }, // pending, claimed, cooking, ready, delivered, cancelled_warn, cancelled_fdo
    item: String,
    is_vip: Boolean,
    created_at: { type: Date, default: Date.now },
    chef_name: String,
    deliverer_id: String,
    claimed_at: Date,
    ready_at: Date,
    images: [String],
    rating: Number,
    complaint: String,
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
    expires_at: Date,
    redeemed_code: String
});

const codeSchema = new mongoose.Schema({
    code: String,
    status: { type: String, default: 'unused' },
    created_by: String,
    redeemed_by: String,
    redeemed_at: Date
});

const vacationSchema = new mongoose.Schema({
    user_id: String,
    status: String, // active, expired
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
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// --- 4. HELPERS ---

const isStaff = (member) => {
    if (!member) return false;
    const roles = member.roles.cache;
    return roles.has(ROLES.COOK) || roles.has(ROLES.DELIVERY) || roles.has(ROLES.MANAGER) || member.id === ROLES.OWNER;
};

const isManager = (member) => {
    if (!member) return false;
    return member.roles.cache.has(ROLES.MANAGER) || member.id === ROLES.OWNER;
};

const hasBypass = (member) => {
    if (ROLES.BYPASS === '0' || !member) return false;
    return member.roles.cache.has(ROLES.BYPASS);
};

const updateMasterLog = async (orderId) => {
    try {
        const channel = await client.channels.fetch(CHANNELS.BACKUP).catch(() => null);
        if (!channel) return;

        const o = await Order.findOne({ order_id: orderId });
        if (!o) return;

        const statusMap = {
            "pending": { text: "⬜ PENDING", color: 0x95a5a6 },
            "claimed": { text: "✋ CLAIMED", color: BRAND_COLOR },
            "cooking": { text: "👨‍🍳 COOKING", color: 0xe67e22 },
            "ready": { text: "📦 READY", color: 0x2ecc71 },
            "delivered": { text: "🚴 DELIVERED", color: 0x3498db },
            "cancelled_warn": { text: "⚠️ CANCELLED (WARN)", color: 0xe74c3c },
            "cancelled_fdo": { text: "🛑 CANCELLED (FORCE)", color: 0x992d22 }
        };

        const statusData = statusMap[o.status] || { text: "UNKNOWN", color: 0x000000 };
        const createdTs = Math.floor(o.created_at.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setTitle(`🍩 ${BRAND_NAME} Order #${o.order_id}`)
            .setColor(statusData.color)
            .addFields(
                { name: 'Status', value: `**${statusData.text}**`, inline: true },
                { name: 'Item', value: o.item, inline: true },
                { name: 'Client', value: `<@${o.user_id}>`, inline: true },
                { name: 'Chef', value: o.chef_name || 'None', inline: true },
                { name: 'Deliverer', value: o.deliverer_id ? `<@${o.deliverer_id}>` : 'None', inline: true },
                { name: 'Created', value: `<t:${createdTs}:R>`, inline: true }
            );

        if (!o.backup_msg_id) {
            const msg = await channel.send({ embeds: [embed] });
            o.backup_msg_id = msg.id;
            await o.save();
        } else {
            try {
                const msg = await channel.messages.fetch(o.backup_msg_id);
                await msg.edit({ embeds: [embed] });
            } catch (e) {
                const msg = await channel.send({ embeds: [embed] });
                o.backup_msg_id = msg.id;
                await o.save();
            }
        }
    } catch (e) { console.error(e); }
};

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

const generateCode = () => {
    const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return `VIP-${seg()}-${seg()}-${seg()}`;
};

// --- 5. INITIALIZATION & EVENTS ---

client.once('ready', async () => {
    console.log(`🚀 ${BRAND_NAME} is ONLINE as ${client.user.tag}`);
    
    // Connect to Mongo
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");
    } catch (e) {
        console.error("❌ MongoDB Connection Error:", e);
    }

    // Register Slash Commands
    const commands = [
        {
            name: 'order',
            description: 'Place a new order',
            options: [{ name: 'item', type: 3, description: 'What do you want to order?', required: true }]
        },
        {
            name: 'orderlist',
            description: 'View the active queue'
        },
        {
            name: 'claim',
            description: 'Claim an order (Cooks)',
            options: [{ name: 'id', type: 3, description: 'Order ID', required: true }]
        },
        {
            name: 'unclaim',
            description: 'Release an order',
            options: [{ name: 'id', type: 3, description: 'Order ID', required: true }]
        },
        {
            name: 'cook',
            description: 'Finish cooking an order',
            options: [
                { name: 'id', type: 3, description: 'Order ID', required: true },
                { name: 'image', type: 11, description: 'Proof of food', required: true },
                { name: 'extra1', type: 11, description: 'Extra Image', required: false }
            ]
        },
        {
            name: 'deliver',
            description: 'Deliver an order',
            options: [{ name: 'id', type: 3, description: 'Order ID', required: true }]
        },
        {
            name: 'setscript',
            description: 'Set custom delivery message',
            options: [{ name: 'message', type: 3, description: 'Your custom script', required: true }]
        },
        {
            name: 'warn',
            description: 'Cancel order and warn user',
            options: [
                { name: 'id', type: 3, description: 'Order ID', required: true },
                { name: 'reason', type: 3, description: 'Reason for warning', required: true }
            ]
        },
        {
            name: 'fdo',
            description: 'Force Delete Order (Manager)',
            options: [
                { name: 'id', type: 3, description: 'Order ID', required: true },
                { name: 'reason', type: 3, description: 'Reason', required: true }
            ]
        },
        {
            name: 'vacation',
            description: 'Request time off',
            options: [
                { name: 'days', type: 4, description: '1-14 Days', required: true },
                { name: 'reason', type: 3, description: 'Reason', required: true }
            ]
        },
        {
            name: 'quota',
            description: 'Check your weekly quota'
        },
        {
            name: 'stats',
            description: 'View staff stats',
            options: [{ name: 'user', type: 6, description: 'Target user', required: false }]
        },
        {
            name: 'rate',
            description: 'Rate your order',
            options: [
                { name: 'id', type: 3, description: 'Order ID', required: true },
                { name: 'stars', type: 4, description: '1-5 Stars', required: true }
            ]
        },
        {
            name: 'complain',
            description: 'File a complaint',
            options: [
                { name: 'id', type: 3, description: 'Order ID', required: true },
                { name: 'reason', type: 3, description: 'Reason', required: true }
            ]
        },
        {
            name: 'invite',
            description: 'Get bot invite link'
        },
        {
            name: 'redeem',
            description: 'Redeem Premium Code',
            options: [{ name: 'code', type: 3, description: 'VIP Code', required: true }]
        },
        {
            name: 'generate_codes',
            description: 'Owner Only: Generate codes',
            options: [{ name: 'amount', type: 4, description: 'Amount', required: true }]
        },
        {
            name: 'addvip',
            description: 'Owner Only: Add VIP',
            options: [{ name: 'user', type: 6, description: 'User', required: true }]
        },
        {
            name: 'removevip',
            description: 'Owner Only: Remove VIP',
            options: [{ name: 'user', type: 6, description: 'User', required: true }]
        },
        {
            name: 'unban',
            description: 'Manager: Unban user',
            options: [{ name: 'user', type: 6, description: 'User', required: true }]
        },
        {
            name: 'rules',
            description: 'View rules'
        },
        {
            name: 'orderinfo',
            description: 'View order details',
            options: [{ name: 'id', type: 3, description: 'Order ID', required: true }]
        }
    ];

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Application Commands Registered.');
    } catch (error) {
        console.error(error);
    }

    // --- INTERVALS (CRON JOBS) ---
    
    // Auto Delivery (Every minute)
    setInterval(async () => {
        const threshold = new Date(Date.now() - 20 * 60000); // 20 mins ago
        const overdue = await Order.find({ status: 'ready', ready_at: { $lt: threshold } });
        
        for (const o of overdue) {
            try {
                const guild = client.guilds.cache.get(o.guild_id);
                if (guild) {
                    const channel = guild.channels.cache.get(o.channel_id);
                    if (channel) {
                        let imgStr = o.images.length > 0 ? o.images.join('\n') : "";
                        await channel.send(`<@${o.user_id}> 🤖 **Auto-Delivery**\nChef: ${o.chef_name}\n${imgStr}`);
                        o.status = 'delivered';
                        o.deliverer_id = 'AUTO_BOT';
                        await o.save();
                        updateMasterLog(o.order_id);
                    }
                }
            } catch(e) {}
        }
    }, 60000);

    // Auto Unclaim (Every minute)
    setInterval(async () => {
        const threshold = new Date(Date.now() - 4 * 60000);
        const expired = await Order.find({ status: 'claimed', claimed_at: { $lt: threshold } });
        const channel = client.channels.cache.get(CHANNELS.COOK);
        
        for (const o of expired) {
            o.status = 'pending';
            o.chef_name = null;
            o.claimed_at = null;
            await o.save();
            updateMasterLog(o.order_id);
            if(channel) channel.send(`📢 **Claim Expired!** \`${o.order_id}\` is **Pending** again.`);
        }
    }, 60000);

    // Premium Expiry (Every Hour)
    setInterval(async () => {
        const now = new Date();
        const expired = await PremiumUser.find({ is_vip: true, expires_at: { $lt: now } });
        for (const u of expired) {
            u.is_vip = false;
            u.expires_at = null;
            await u.save();
            try {
                const guild = client.guilds.cache.get(SUPPORT_SERVER_ID);
                if(guild) {
                    const member = await guild.members.fetch(u.user_id).catch(() => null);
                    if(member) member.roles.remove(ROLES.VIP).catch(() => {});
                }
            } catch(e) {}
        }
    }, 3600000);

    // Vacation Check (Every Hour)
    setInterval(async () => {
        const now = new Date();
        const expired = await Vacation.find({ status: 'active', end_date: { $lt: now } });
        for (const v of expired) {
            v.status = 'expired';
            await v.save();
            // Remove bypass roles
            for (const [id, guild] of client.guilds.cache) {
                const member = await guild.members.fetch(v.user_id).catch(() => null);
                if(member) {
                    member.roles.remove(ROLES.BYPASS).catch(() => {});
                    member.send("👋 **Welcome Back!** Your vacation has ended.").catch(()=>{});
                }
            }
        }
    }, 3600000);
});

// --- 6. INTERACTION HANDLER ---

client.on('interactionCreate', async interaction => {
    // --- MODAL HANDLING ---
    if (interaction.isModalSubmit()) {
        const [action, userId] = interaction.customId.split('_');
        
        if (action === 'vacEdit') {
            const days = parseInt(interaction.fields.getTextInputValue('days'));
            if (isNaN(days) || days < 1 || days > 14) return interaction.reply({ content: "❌ 1-14 days only.", ephemeral: true });

            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);

            await Vacation.findOneAndUpdate(
                { user_id: userId },
                { status: 'active', end_date: endDate },
                { upsert: true }
            );

            const guild = interaction.guild;
            const target = await guild.members.fetch(userId).catch(() => null);
            if (target) target.roles.add(ROLES.BYPASS).catch(() => {});

            // Update Embed
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0x00FF00) // Green
                .spliceFields(1, 1, { name: 'Duration', value: `${days} Days (Edited)`, inline: true })
                .setFooter({ text: `Approved (Edited) by ${interaction.user.username}` });

            await interaction.message.edit({ embeds: [embed], components: [] });
            await interaction.reply({ content: `✅ Edited to ${days} days.`, ephemeral: true });
        }
        
        if (action === 'vacDeny') {
            const reason = interaction.fields.getTextInputValue('reason');
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0xFF0000)
                .addFields({ name: 'Denial Reason', value: reason })
                .setFooter({ text: `Denied by ${interaction.user.username}` });

            await interaction.message.edit({ embeds: [embed], components: [] });
            await interaction.reply({ content: "❌ Request Denied.", ephemeral: true });
            
            const target = await client.users.fetch(userId).catch(() => null);
            if(target) target.send(`❌ **Vacation Denied**\nReason: ${reason}`).catch(() => {});
        }
        return;
    }

    // --- BUTTON HANDLING (Vacation) ---
    if (interaction.isButton()) {
        if (!isManager(interaction.member)) return interaction.reply({ content: "❌ Managers only.", ephemeral: true });
        
        const [action, userId, daysStr] = interaction.customId.split('_');
        const days = parseInt(daysStr);

        if (action === 'vacApprove') {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);

            await Vacation.findOneAndUpdate(
                { user_id: userId },
                { status: 'active', end_date: endDate },
                { upsert: true }
            );

            const target = await interaction.guild.members.fetch(userId).catch(() => null);
            if (target) target.roles.add(ROLES.BYPASS).catch(() => {});

            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor(0x00FF00)
                .setFooter({ text: `Approved by ${interaction.user.username}` });

            await interaction.message.edit({ embeds: [embed], components: [] });
            await interaction.reply({ content: "✅ Approved.", ephemeral: true });
            if(target) target.send(`🌴 **Approved!** Ends <t:${Math.floor(endDate.getTime()/1000)}:R>`).catch(() => {});
        }

        if (action === 'vacEditBtn') {
            const modal = new ModalBuilder()
                .setCustomId(`vacEdit_${userId}`)
                .setTitle("Edit Duration");
            const input = new TextInputBuilder()
                .setCustomId('days')
                .setLabel('New Days (1-14)')
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }

        if (action === 'vacDenyBtn') {
            const modal = new ModalBuilder()
                .setCustomId(`vacDeny_${userId}`)
                .setTitle("Deny Request");
            const input = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Reason')
                .setStyle(TextInputStyle.Paragraph);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // --- COMMAND LOGIC ---

    if (commandName === 'order') {
        const item = interaction.options.getString('item');
        const uid = interaction.user.id;

        // Check Ban
        const userConfig = await User.findOne({ user_id: uid });
        if (userConfig) {
            if (userConfig.is_banned === 1) return interaction.reply({ content: `🛑 **Permanently Banned.** Appeal: ${SUPPORT_SERVER_LINK}`, ephemeral: true });
            if (userConfig.ban_expires_at && userConfig.ban_expires_at > new Date()) {
                const ts = Math.floor(userConfig.ban_expires_at.getTime() / 1000);
                return interaction.reply({ content: `🛑 **Temp Banned.** Return <t:${ts}:R>.`, ephemeral: true });
            }
        }

        // Check active order
        const active = await Order.findOne({ user_id: uid, status: { $in: ['pending', 'claimed', 'cooking', 'ready'] } });
        if (active) return interaction.reply({ content: "❌ You already have an active order.", ephemeral: true });

        // VIP Check
        const vip = await PremiumUser.findOne({ user_id: uid, is_vip: true });
        const oid = Math.random().toString(36).substring(2, 8).toUpperCase();

        const newOrder = new Order({
            order_id: oid,
            user_id: uid,
            guild_id: interaction.guild.id,
            channel_id: interaction.channel.id,
            item: item,
            is_vip: !!vip,
            status: 'pending'
        });
        await newOrder.save();
        updateMasterLog(oid);

        // Notify Kitchen
        const cookChannel = client.channels.cache.get(CHANNELS.COOK);
        if (cookChannel) {
            const prefix = !!vip ? "💎 **VIP ORDER!**" : "🍩 **New Order!**";
            const ping = !!vip ? "@here" : ""; 
            await cookChannel.send(`${prefix} \`${oid}\`\nClient: <@${uid}>\nRequest: **${item}**\n📍 Server: ${interaction.guild.name}\n${ping}`);
        }
        return interaction.reply({ content: `✅ Order \`${oid}\` placed!`, ephemeral: true });
    }

    if (commandName === 'claim') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        if (interaction.channel.id !== CHANNELS.COOK && !isManager(interaction.member)) return interaction.reply({ content: "❌ Wrong channel.", ephemeral: true });

        const oid = interaction.options.getString('id');
        const order = await Order.findOne({ order_id: oid });

        if (!order || order.status !== 'pending') return interaction.reply({ content: "❌ Cannot claim.", ephemeral: true });

        order.status = 'claimed';
        order.chef_name = interaction.user.username;
        order.claimed_at = new Date();
        await order.save();
        updateMasterLog(oid);

        interaction.reply({ content: `⏱️ Claimed \`${oid}\`. Cook within 4 minutes.` });
        
        try {
            const u = await client.users.fetch(order.user_id);
            u.send(`👨‍🍳 **Claimed!** Your order \`${oid}\` is being prepped by **${interaction.user.username}**.`);
        } catch(e) {}
    }

    if (commandName === 'cook') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        
        const oid = interaction.options.getString('id');
        const img = interaction.options.getAttachment('image');
        const ex1 = interaction.options.getAttachment('extra1');

        const order = await Order.findOne({ order_id: oid });
        if (!order) return interaction.reply({ content: "❌ Not found.", ephemeral: true });
        if (order.status !== 'claimed' || order.chef_name !== interaction.user.username) return interaction.reply({ content: "❌ Not your claim.", ephemeral: true });

        const images = [img.url];
        if (ex1) images.push(ex1.url);

        order.status = 'cooking';
        order.images = images;
        await order.save();

        // Update User Stats
        await User.findOneAndUpdate({ user_id: interaction.user.id }, { $inc: { cook_count_week: 1, cook_count_total: 1 } }, { upsert: true });

        updateMasterLog(oid);
        await interaction.reply(`👨‍🍳 Cooking \`${oid}\`... (3m)`);
        
        // Notify User
        try {
            const finishTs = Math.floor((Date.now() + 180000) / 1000);
            const u = await client.users.fetch(order.user_id);
            u.send(`🍳 **Cooking!** Ready <t:${finishTs}:R>.`);
        } catch(e) {}

        // Timer
        setTimeout(async () => {
            const o = await Order.findOne({ order_id: oid });
            if (o && o.status === 'cooking') {
                o.status = 'ready';
                o.ready_at = new Date();
                await o.save();
                updateMasterLog(oid);
                
                const dc = client.channels.cache.get(CHANNELS.DELIVERY);
                if(dc) dc.send(`📦 **Ready!** \`${oid}\`\nChef: ${interaction.user.username}\nUse \`/deliver ${oid}\``);
                
                try {
                    const u = await client.users.fetch(order.user_id);
                    u.send(`📦 **Ready!** Waiting for delivery.`);
                } catch(e) {}
            }
        }, 180000); // 3 mins
    }

    if (commandName === 'deliver') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        
        const oid = interaction.options.getString('id');
        const order = await Order.findOne({ order_id: oid });

        if (!order || order.status !== 'ready') return interaction.reply({ content: "❌ Not ready.", ephemeral: true });

        const scriptDoc = await Script.findOne({ user_id: interaction.user.id });
        const script = scriptDoc ? scriptDoc.script : "Here is your order! 🍩";
        const imgs = order.images.join('\n');
        
        // Try Invite
        const guild = client.guilds.cache.get(order.guild_id);
        if (!guild) return interaction.reply({ content: "❌ I'm not in that server.", ephemeral: true });

        let invite = null;
        const targetChannel = guild.channels.cache.get(order.channel_id);
        if (targetChannel) {
            try { invite = await targetChannel.createInvite({ maxAge: 300, maxUses: 1 }); } catch(e) {}
        }

        if (invite) {
            try {
                await interaction.user.send(`🚴 **Delivery** \`${oid}\`\n**Link:** ${invite.url}\n**Post:**\n\`\`\`\n<@${order.user_id}> ${script}\nChef: ${order.chef_name}\n${imgs}\n\`\`\``);
                
                order.status = 'delivered';
                order.deliverer_id = interaction.user.id;
                await order.save();

                await User.findOneAndUpdate({ user_id: interaction.user.id }, { $inc: { deliver_count_week: 1, deliver_count_total: 1 } }, { upsert: true });
                updateMasterLog(oid);
                
                interaction.reply({ content: "✅ Check DMs.", ephemeral: true });
            } catch (e) {
                interaction.reply({ content: "❌ Open DMs.", ephemeral: true });
            }
        } else {
             // Fallback Auto
             if (targetChannel) {
                targetChannel.send(`🤖 **Auto-Delivery** (Invite Failed)\n<@${order.user_id}> ${script}\nChef: ${order.chef_name}\n${imgs}`);
                order.status = 'delivered';
                order.deliverer_id = 'AUTO_FALLBACK';
                await order.save();
                updateMasterLog(oid);
                interaction.reply({ content: "⚠️ Invite failed. Auto-delivered.", ephemeral: true });
             } else {
                interaction.reply({ content: "❌ Server locked down.", ephemeral: true });
             }
        }
    }

    if (commandName === 'vacation') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        
        const days = interaction.options.getInteger('days');
        const reason = interaction.options.getString('reason');

        if (days < 1 || days > 14) return interaction.reply({ content: "❌ 1-14 days.", ephemeral: true });

        const existing = await Vacation.findOne({ user_id: interaction.user.id, status: 'active' });
        if (existing) return interaction.reply({ content: "❌ Active vacation exists.", ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle("🌴 Vacation Request")
            .setColor(0x1abc9c)
            .addFields(
                { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Duration', value: `${days} Days`, inline: true },
                { name: 'Reason', value: reason }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vacApprove_${interaction.user.id}_${days}`).setLabel('Approve').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`vacEditBtn_${interaction.user.id}_${days}`).setLabel('Edit').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`vacDenyBtn_${interaction.user.id}_${days}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
        );

        const channel = client.channels.cache.get(CHANNELS.VACATION);
        if(channel) await channel.send({ embeds: [embed], components: [row] });
        interaction.reply({ content: "✅ Request sent.", ephemeral: true });
    }

    if (commandName === 'warn' || commandName === 'fdo') {
        if (!isManager(interaction.member) && !isStaff(interaction.member)) return interaction.reply({ content: "❌ Perms.", ephemeral: true });
        
        const oid = interaction.options.getString('id');
        const reason = interaction.options.getString('reason');
        const order = await Order.findOne({ order_id: oid });
        
        if (!order) return interaction.reply("❌ Invalid ID.");
        
        const isFdo = commandName === 'fdo';
        order.status = isFdo ? 'cancelled_fdo' : 'cancelled_warn';
        await order.save();
        updateMasterLog(oid);

        const u = await User.findOneAndUpdate({ user_id: order.user_id }, { $inc: { warnings: 1 } }, { new: true, upsert: true });
        
        let banMsg = "";
        if (u.warnings === 3) {
            const exp = new Date(); exp.setDate(exp.getDate() + 7);
            u.ban_expires_at = exp;
            banMsg = "\n⏳ **7-DAY BAN**";
        } else if (u.warnings === 6) {
            const exp = new Date(); exp.setDate(exp.getDate() + 30);
            u.ban_expires_at = exp;
            banMsg = "\n⏳ **30-DAY BAN**";
        } else if (u.warnings >= 9) {
            u.is_banned = 1;
            banMsg = "\n🛑 **PERMANENT BAN**";
        }
        await u.save();

        const warnChan = client.channels.cache.get(CHANNELS.WARNING);
        if(warnChan) warnChan.send(`⚠️ **Warned** <@${order.user_id}> | Reason: ${reason} | Strikes: ${u.warnings} ${banMsg}`);
        
        try {
            const target = await client.users.fetch(order.user_id);
            target.send(`⚠️ **Warning**\nReason: ${reason}\nStrikes: ${u.warnings}${banMsg}`);
        } catch(e){}

        interaction.reply(`Action taken. Strikes: ${u.warnings}`);
    }

    if (commandName === 'invite') {
        const link = client.generateInvite({
            scopes: ['bot', 'applications.commands'],
            permissions: [
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.EmbedLinks,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.CreateInstantInvite
            ]
        });
        const embed = new EmbedBuilder().setTitle(`Invite ${BRAND_NAME}`).setDescription("Click button below").setColor(BRAND_COLOR);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Invite Me").setStyle(ButtonStyle.Link).setURL(link));
        interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (commandName === 'generate_codes') {
        if (interaction.user.id !== ROLES.OWNER) return interaction.reply("❌ Owner only.");
        const amount = interaction.options.getInteger('amount');
        if (amount < 1 || amount > 50) return interaction.reply("1-50 only.");
        
        let txt = "";
        for (let i=0; i<amount; i++) {
            const c = generateCode();
            await new PremiumCode({ code: c, created_by: interaction.user.id }).save();
            txt += c + "\n";
        }
        
        interaction.reply({ files: [{ attachment: Buffer.from(txt), name: 'codes.txt' }], ephemeral: true });
    }

    if (commandName === 'redeem') {
        const codeStr = interaction.options.getString('code');
        const code = await PremiumCode.findOneAndUpdate(
            { code: codeStr, status: 'unused' },
            { status: 'redeemed', redeemed_by: interaction.user.id, redeemed_at: new Date() }
        );

        if (!code) return interaction.reply({ content: "❌ Invalid code.", ephemeral: true });

        const exp = new Date();
        exp.setDate(exp.getDate() + 30);
        
        await PremiumUser.findOneAndUpdate(
            { user_id: interaction.user.id },
            { is_vip: true, expires_at: exp, redeemed_code: codeStr },
            { upsert: true }
        );

        // Add Role
        try {
            const guild = client.guilds.cache.get(SUPPORT_SERVER_ID);
            const member = await guild.members.fetch(interaction.user.id);
            member.roles.add(ROLES.VIP);
        } catch(e) {}

        interaction.reply({ content: "💎 **VIP Activated** for 30 days!", ephemeral: true });
    }

    if (commandName === 'rules') {
        const embed = new EmbedBuilder().setTitle(`${BRAND_NAME} Rules`).setColor(BRAND_COLOR)
            .addFields(
                { name: "1. The Golden Rule", value: "**Every order MUST include a donut.**" },
                { name: "2. Conduct", value: "No NSFW." },
                { name: "3. Queue", value: "1 Active order at a time." },
                { name: "4. Max Items", value: "3 Items per order." }
            );
        interaction.reply({ embeds: [embed] });
    }
});

client.login(BOT_TOKEN);
