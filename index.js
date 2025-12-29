/**
 * ============================================================================
 * SUGAR RUSH - MASTER DISCORD AUTOMATION INFRASTRUCTURE
 * ============================================================================
 * * VERSION: 56.0.0 (OFFICIAL STORE INTEGRATION & FULL EXPANSION)
 * * ----------------------------------------------------------------------------
 * 🍩 SYSTEM UPDATES:
 * 1. Store Integration: /premium now points to https://donuts.sell.app/
 * 2. Interaction Safety: Unified defer/reply logic for orders and delivery.
 * 3. VIP Stacking: Time is added to the current expiration date.
 * 4. Manual Join Dispatch: DMs Couriers with Invite, Script, and Customer Tag.
 * ----------------------------------------------------------------------------
 * 🍩 THE COMMAND REGISTRY:
 * CONSUMER: /help, /order, /super_order, /orderstatus, /daily, /balance, 
 * /premium, /redeem, /review, /rules, /invite, /support, /tip.
 * STAFF: /claim, /cook, /warn, /deliver, /setscript, /stats, /vacation.
 * MGMT: /fdo, /force_warn, /search, /refund, /ban, /unban.
 * OWNER: !eval, /generate_codes, /serverblacklist.
 * ============================================================================
 */


require('dotenv').config();


const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST, 
    Routes, 
    ActivityType 
} = require('discord.js');


const mongoose = require('mongoose');


const { google } = require('googleapis');


const util = require('util');


// --- 1. GLOBAL SETTINGS ---


const BOT_TOKEN = process.env.DISCORD_TOKEN;


const MONGO_URI = process.env.MONGO_URI;


const SHEET_ID = process.env.GOOGLE_SHEET_ID;


const OWNER_ID = '662655499811946536';


const SUPPORT_SERVER_ID = '1454857011866112063';


const STORE_LINK = "https://donuts.sell.app/";


const SUPPORT_INVITE = "https://discord.gg/Q4DsEbJzBJ";


const ROLES = {


    COOK: '1454877400729911509',


    DELIVERY: '1454877287953469632',


    MANAGER: '1454876343878549630',


    OWNER: OWNER_ID,


    QUOTA_EXEMPT: '1454936082591252534'


};


const CHANNELS = {


    COOK: '1454879418999767122',


    DELIVERY: '1454880879741767754',


    BACKUP: '1454888266451910901',


    QUOTA: '1454895987322519672',


    WARNING_LOG: '1454881451161026637',


    BLACKLIST_LOG: '1455092188626292852',


    VACATION_REQUEST: '1454886383662665972',


    RATINGS: '1454884136740327557'


};


const BRAND_NAME = "Sugar Rush";


const BRAND_COLOR = 0xFFA500;


const SUCCESS_COLOR = 0x2ECC71;


const ERROR_COLOR = 0xFF0000;


// --- 2. DATABASE MODELS ---


const User = mongoose.model('User', new mongoose.Schema({


    user_id: { type: String, required: true, unique: true },


    balance: { type: Number, default: 0 },


    last_daily: { type: Date, default: new Date(0) },


    cook_count_week: { type: Number, default: 0 },


    cook_count_total: { type: Number, default: 0 },


    deliver_count_week: { type: Number, default: 0 },


    deliver_count_total: { type: Number, default: 0 },


    vip_until: { type: Date, default: new Date(0) }


}));


const Order = mongoose.model('Order', new mongoose.Schema({


    order_id: String,


    user_id: String,


    guild_id: String,


    channel_id: String,


    status: { type: String, default: 'pending' },


    item: String,


    is_vip: { type: Boolean, default: false },


    is_super: { type: Boolean, default: false },


    created_at: { type: Date, default: Date.now },


    chef_name: String,


    chef_id: String,


    deliverer_id: String,


    ready_at: Date,


    images: [String],


    backup_msg_id: String


}));


const VIPCode = mongoose.model('VIPCode', new mongoose.Schema({ 


    code: { type: String, unique: true }, 


    is_used: { type: Boolean, default: false } 


}));


const Script = mongoose.model('Script', new mongoose.Schema({ 


    user_id: String, 


    script: String 


}));


// --- 3. INFRASTRUCTURE HELPERS ---


const createBrandedEmbed = (title, description, color = BRAND_COLOR, fields = []) => {


    return new EmbedBuilder()
        .setAuthor({ name: BRAND_NAME })
        .setTitle(title)
        .setDescription(description || null)
        .setColor(color)
        .setFooter({ text: `${BRAND_NAME} Executive Management` })
        .setTimestamp()
        .addFields(fields);


};


const getGlobalPerms = async (userId) => {


    if (userId === OWNER_ID) {
        return { 
            isStaff: true, 
            isManager: true, 
            isCook: true, 
            isDelivery: true, 
            isOwner: true 
        };
    }


    try {


        const supportGuild = client.guilds.cache.get(SUPPORT_SERVER_ID);


        const member = await supportGuild.members.fetch(userId);


        const isManager = member.roles.cache.has(ROLES.MANAGER);


        const isCook = member.roles.cache.has(ROLES.COOK);


        const isDelivery = member.roles.cache.has(ROLES.DELIVERY);


        return { 
            isManager, 
            isCook: isCook || isManager, 
            isDelivery: isDelivery || isManager, 
            isStaff: isCook || isDelivery || isManager, 
            isOwner: false 
        };


    } catch (e) { 


        return { isStaff: false, isManager: false, isCook: false, isDelivery: false, isOwner: false }; 


    }


};


// --- 4. CORE ENGINE & FAILSAFE ---


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
});


client.once('ready', async () => {


    console.log(`[BOOT] Sugar Rush v56.0.0 Online.`);


    await mongoose.connect(MONGO_URI);


    client.user.setPresence({ 
        activities: [{ name: '/order | Sugar Rush', type: ActivityType.Playing }], 
        status: 'online' 
    });


    setInterval(checkAutoDelivery, 60000);


});


async function checkAutoDelivery() {


    const limit = new Date(Date.now() - 1200000);


    const staled = await Order.find({ 
        status: 'ready', 
        ready_at: { $lt: limit } 
    });


    for (const o of staled) {


        try {


            const node = client.guilds.cache.get(o.guild_id)?.channels.cache.get(o.channel_id);


            if (node) {


                const embed = createBrandedEmbed("🍩 Premium Fulfillment Complete", "Your order has been finalized and dispatched via HQ Automated Backup.", BRAND_COLOR);


                if (o.images?.length > 0) {
                    embed.setImage(o.images[0]);
                }


                await node.send({ content: `<@${o.user_id}>`, embeds: [embed] });


                o.status = 'delivered'; 
                
                o.deliverer_id = 'SYSTEM_FAILSAFE'; 
                
                await o.save();


            }


        } catch (e) {}


    }


}


// --- 5. INTERACTION HANDLER ---


client.on('interactionCreate', async (interaction) => {


    if (!interaction.isChatInputCommand()) return;


    const { commandName, options } = interaction;


    const perms = await getGlobalPerms(interaction.user.id);


    const uData = await User.findOne({ user_id: interaction.user.id }) || new User({ user_id: interaction.user.id });


    const isPublic = [
        'help', 'order', 'super_order', 'orderstatus', 'daily', 
        'balance', 'premium', 'rules', 'redeem', 'review', 
        'tip', 'invite', 'support'
    ].includes(commandName);


    // Special handle for deliver (ephemeral briefing, public fulfillment)
    if (commandName !== 'deliver') {
        await interaction.deferReply({ ephemeral: !isPublic });
    }


    // --- PREMIUM COMMAND ---


    if (commandName === 'premium') {


        const premiumEmbed = createBrandedEmbed(
            "💎 Sugar Rush Premium Access", 
            "Upgrade your experience within the Sugar Rush economy.", 
            BRAND_COLOR, 
            [
                { name: "🍩 50% Discount", value: "Standard orders cost 50 Coins instead of 100.", inline: true },
                { name: "💰 Double Dailies", value: "Receive 2,000 Coins every 24 hours.", inline: true },
                { name: "🚀 Priority", value: "Highlighted kitchen requests for staff.", inline: true }
            ]
        );


        premiumEmbed.addFields({ 
            name: "💳 Purchase VIP Keys", 
            value: `Get your keys at our official store:\n**[donuts.sell.app](${STORE_LINK})**` 
        });


        return interaction.editReply({ embeds: [premiumEmbed] });


    }


    // --- ORDER COMMANDS ---


    if (commandName === 'order' || commandName === 'super_order') {


        const isSuper = commandName === 'super_order';


        const cost = isSuper ? 150 : (uData.vip_until > Date.now() ? 50 : 100);


        if (uData.balance < cost) {
            return interaction.editReply(`❌ Insufficient coins. Required: **${cost}**.`);
        }


        const oid = Math.random().toString(36).substring(2, 8).toUpperCase();


        const newOrder = new Order({ 
            order_id: oid, 
            user_id: interaction.user.id, 
            guild_id: interaction.guildId, 
            channel_id: interaction.channelId, 
            item: options.getString('item'), 
            is_vip: uData.vip_until > Date.now(), 
            is_super: isSuper 
        });


        await newOrder.save();


        uData.balance -= cost;


        await uData.save();


        client.channels.cache.get(CHANNELS.COOK)?.send({ 
            content: isSuper ? "@here 🚀 **SUPER ORDER ALERT**" : null, 
            embeds: [createBrandedEmbed(isSuper ? "🚀 Super Order" : "🍩 New Request", `ID: \`${oid}\` | Item: ${options.getString('item')}`)] 
        });


        return interaction.editReply({ 
            embeds: [createBrandedEmbed("✅ Order Authorized", `Reference ID: \`${oid}\` sent to HQ.`, SUCCESS_COLOR)] 
        });


    }


    // --- DELIVERY COMMAND ---


    if (commandName === 'deliver') {


        const o = await Order.findOne({ 
            order_id: options.getString('id'), 
            status: 'ready' 
        });


        if (!o) {
            return interaction.reply({ content: "❌ Order not ready.", ephemeral: true });
        }


        const targetGuild = client.guilds.cache.get(o.guild_id);


        const targetChannel = targetGuild?.channels.cache.get(o.channel_id);


        if (!targetGuild || !targetChannel) {
            return interaction.reply({ content: "❌ Destination unavailable.", ephemeral: true });
        }


        if (!targetGuild.members.cache.has(interaction.user.id)) {


            const invite = await targetChannel.createInvite({ maxAge: 1800, maxUses: 1 });


            const script = await Script.findOne({ user_id: interaction.user.id });


            const customer = await client.users.fetch(o.user_id);


            const dmEmbed = createBrandedEmbed("🚴 Dispatch Briefing", null, BRAND_COLOR, [
                { name: "📍 Destination", value: `**Server:** ${targetGuild.name}\n**Invite:** ${invite.url}` },
                { name: "👤 Customer", value: `**Tag:** <@${customer.id}>\n**ID:** \`${customer.id}\`` },
                { name: "📝 Your Script", value: `\`\`\`${script?.script || "Enjoy!"}\`\`\`` }
            ]);


            if (o.images?.length > 0) dmEmbed.setImage(o.images[0]);


            await interaction.user.send({ embeds: [dmEmbed] });


            return interaction.reply({ 
                content: "📫 **Briefing Sent.** Check your DMs for server info and customer ID.", 
                ephemeral: true 
            });


        }


        await interaction.reply({ content: "🚴 Finalizing delivery...", ephemeral: true });


        const script = await Script.findOne({ user_id: interaction.user.id });


        await targetChannel.send({ 
            content: `<@${o.user_id}>`, 
            embeds: [createBrandedEmbed("🚴 Delivery!", script?.script || "Enjoy!").setImage(o.images[0] || null)] 
        });


        o.status = 'delivered'; 
        
        o.deliverer_id = interaction.user.id; 
        
        await o.save();


        uData.balance += 30; 
        
        await uData.save();


        return interaction.followUp({ content: "✅ Fulfillment successful.", ephemeral: true });


    }


    // --- REDEEM & DAILY ---


    if (commandName === 'redeem') {


        const codeData = await VIPCode.findOne({ 
            code: options.getString('code'), 
            is_used: false 
        });


        if (!codeData) return interaction.editReply("❌ Invalid or expired Key.");


        const now = new Date();


        const thirtyDays = 30 * 24 * 60 * 60 * 1000;


        let newExp = (uData.vip_until > now) ? new Date(uData.vip_until.getTime() + thirtyDays) : new Date(now.getTime() + thirtyDays);


        uData.vip_until = newExp; 
        
        codeData.is_used = true;


        await uData.save(); 
        
        await codeData.save();


        return interaction.editReply({ 
            embeds: [createBrandedEmbed("💎 VIP Activated", `New Expiration: **${newExp.toDateString()}**`, SUCCESS_COLOR)] 
        });


    }


    if (commandName === 'daily') {


        if (Date.now() - uData.last_daily < 86400000) {
            return interaction.editReply("❌ Cooldown Active.");
        }


        const pay = (uData.vip_until > Date.now()) ? 2000 : 1000;


        uData.balance += pay; 
        
        uData.last_daily = Date.now(); 
        
        await uData.save();


        return interaction.editReply(`💰 Deposited **${pay} Sugar Coins**.`);


    }


});


client.login(BOT_TOKEN);


/**
 * ============================================================================
 * END OF MASTER INFRASTRUCTURE
 * Version 56.0.0. Store Link Integration Complete.
 * ============================================================================
 */
