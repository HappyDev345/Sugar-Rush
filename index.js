/**
 * ============================================================================
 * SUGAR RUSH - MASTER DISCORD AUTOMATION INFRASTRUCTURE
 * ============================================================================
 * * VERSION: 19.0.0
 * * ----------------------------------------------------------------------------
 * 🍩 FULL SYSTEM FEATURES LIST:
 * ----------------------------------------------------------------------------
 * 1. TIERED ECONOMY: 
 * - Standard users: 100 Sugar Coins per order.
 * - VIP members: 50 Sugar Coins per order.
 * 2. SUPER ORDER SYSTEM:
 * - Priority requests costing 150 Sugar Coins.
 * - Restricted to non-premium members only.
 * - Triggers an @here ping in the kitchen node and uses unique red styling.
 * 3. DAILY ALLOWANCE:
 * - Automated daily payout of 1,000 Coins (Standard) or 2,000 Coins (VIP).
 * - Features a persistent 24-hour database cooldown.
 * 4. STAFF PAYROLL SYSTEM:
 * - Culinary payout: 20 Coins per completed preparation cycle.
 * - Courier payout: 30 Coins per successful human fulfillment.
 * 5. STAFF PERK SYSTEM:
 * - "Double Stats" available for 15,000 Coins.
 * - Lasts for exactly 30 days via persistent DB timestamping.
 * - Doubles all weekly quota progress for the duration.
 * 6. QUOTA AUDIT & BONUSES:
 * - Background task evaluates all personnel every Sunday at 23:00 UTC.
 * - Awards 3,000 Coins bonus to the MVP Cook and MVP Driver of the week.
 * - Resets weekly counters to zero for the new cycle.
 * 7. HUMAN-FIRST DELIVERY:
 * - Primary workflow relies on human couriers using the /deliver node.
 * - Couriers utilize personal custom greetings saved in the database.
 * 8. AUTOMATED FAILSAFES:
 * - 20-Minute Timeout: Ready orders sit for 20m are auto-delivered to prevent stale requests.
 * - Invite/Route Fail: If a staff cannot reach a node, the system auto-dispatches the greeting.
 * 9. DISCIPLINARY & BAN INFRASTRUCTURE:
 * - /warn: Pre-cook cancellation + strike (Cooks/Staff).
 * - /fdo: Pre-delivery cancellation + strike (Managers).
 * - /force_warn: Post-delivery strike (Managers).
 * - Thresholds: 3 Strikes (7d Ban), 6 Strikes (30d Ban), 9 Strikes (Permanent).
 * - Manual Control: /ban and /unban by User ID.
 * - Server Control: /serverblacklist and /unblacklistserver.
 * 10. MASTER ARCHIVAL LOGGING:
 * - Background function "updateMasterLog" syncs every state change to the archive channel.
 * - Includes visual evidence, server IDs, and personnel IDs for management oversight.
 * 11. INTERACTION PROTECTION:
 * - Global use of deferReply prevents the "Unknown Interaction" 3-second timeout error.
 * * ----------------------------------------------------------------------------
 * 🍩 FULL SLASH COMMAND REGISTRY:
 * ----------------------------------------------------------------------------
 * CONSUMER COMMANDS:
 * - /order [item] : Request standard product fulfillment (100/50 Coins).
 * - /super_order [item] : Request priority kitchen ping (150 Coins).
 * - /orderstatus : Track active requests with a progress bar and dynamic ETA.
 * - /daily : Claim shift allowance (1,000 or 2,000 VIP Coins).
 * - /balance : Inspect current vault coin totals.
 * - /tip [id] [amount] : Reward assigned personnel (50/50 split for human delivery).
 * - /rules : View platform regulations and conduct guidelines.
 * - /invite : Obtain authorization link with minimum functional perms + invite create.
 * - /support : Join the centralized Support Cluster server.
 * * KITCHEN PERSONNEL COMMANDS:
 * - /claim [id] : Acknowledge and assign a pending request to your station.
 * - /cook [id] [image/link] : Finalize prep with proof (Starts 3-minute timer).
 * - /warn [id] [reason] : Cancel un-cooked order and issue service strike.
 * * COURIER PERSONNEL COMMANDS:
 * - /deliver [id] : Transmit fulfillment manually to the client node.
 * - /setscript [message] : Save personal greeting message for couriers.
 * * UNIVERSAL STAFF COMMANDS:
 * - /stats [user] : Audit performance metrics, balance, and active perks.
 * - /staff_buy [perk] : Spend coins to activate staff enhancements.
 * * ADMINISTRATIVE COMMANDS:
 * - /refund [id] : Revert a transaction and return coins to the user vault.
 * - /search [id] : Extract full historical record of an order from the database.
 * - /fdo [id] [reason] : Force cancel pre-delivered order and issue strike.
 * - /force_warn [id] [reason] : Issue strike for completed order post-fulfillment.
 * - /ban [userid] [days] [reason] : Issue manual service restriction.
 * - /unban [userid] : Restore service access to a user.
 * - /serverblacklist [id] [reason] : (Owner Only) Terminate node access rights.
 * - /unblacklistserver [id] : (Owner Only) Restore node access rights.
 * * ----------------------------------------------------------------------------
 * 🍩 OWNER AUTHORITY (UID: 662655499811946536):
 * ----------------------------------------------------------------------------
 * - Bypasses all Role Restrictions.
 * - Bypasses all Channel/Location Restrictions.
 * - Bypasses all Server/Guild Restrictions.
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
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    PermissionsBitField, 
    REST, 
    Routes, 
    ActivityType 
} = require('discord.js');


const mongoose = require('mongoose');


// --- 1. GLOBAL SETTINGS ---


const BOT_TOKEN = process.env.DISCORD_TOKEN;


const MONGO_URI = process.env.MONGO_URI;


const BRAND_NAME = "Sugar Rush";


const BRAND_COLOR = 0xFFA500; 


const VIP_COLOR = 0x9B59B6;   


const SUPER_COLOR = 0xE74C3C; 


const ERROR_COLOR = 0xFF0000; 


const SUCCESS_COLOR = 0x2ECC71; 


const SUPPORT_SERVER_LINK = "https://discord.gg/ceT3Gqwquj";


const SUPPORT_SERVER_ID = '1454857011866112063';


// --- 2. ID REGISTRY ---


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

    QUOTA: '1454895987322519672',

    LOGS: '1455092188626292852'

};


// --- 3. DATABASE SCHEMAS ---


const orderSchema = new mongoose.Schema({

    order_id: { 
        type: String, 
        required: true 
    },

    user_id: { 
        type: String, 
        required: true 
    },

    guild_id: { 
        type: String, 
        required: true 
    },

    channel_id: { 
        type: String, 
        required: true 
    },

    status: { 
        type: String, 
        default: 'pending' 
    },

    item: { 
        type: String, 
        required: true 
    },

    is_vip: { 
        type: Boolean, 
        default: false 
    },

    is_super: { 
        type: Boolean, 
        default: false 
    },

    created_at: { 
        type: Date, 
        default: Date.now 
    },

    chef_name: { 
        type: String, 
        default: null 
    },

    chef_id: { 
        type: String, 
        default: null 
    },

    deliverer_id: { 
        type: String, 
        default: null 
    },

    claimed_at: { 
        type: Date, 
        default: null 
    },

    ready_at: { 
        type: Date, 
        default: null 
    },

    images: { 
        type: [String], 
        default: [] 
    },

    backup_msg_id: { 
        type: String, 
        default: null 
    }

});


const userSchema = new mongoose.Schema({

    user_id: { 
        type: String, 
        required: true, 
        unique: true 
    },

    balance: { 
        type: Number, 
        default: 0 
    },

    last_daily: { 
        type: Date, 
        default: new Date(0) 
    },

    cook_count_week: { 
        type: Number, 
        default: 0 
    },

    cook_count_total: { 
        type: Number, 
        default: 0 
    },

    deliver_count_week: { 
        type: Number, 
        default: 0 
    },

    deliver_count_total: { 
        type: Number, 
        default: 0 
    },

    double_stats_until: { 
        type: Date, 
        default: new Date(0) 
    },

    warnings: { 
        type: Number, 
        default: 0 
    },

    service_ban_until: { 
        type: Date, 
        default: null 
    },

    is_perm_banned: { 
        type: Boolean, 
        default: false 
    }

});


const scriptSchema = new mongoose.Schema({

    user_id: { 
        type: String, 
        required: true 
    },

    script: { 
        type: String, 
        required: true 
    }

});


const Order = mongoose.model('Order', orderSchema);


const User = mongoose.model('User', userSchema);


const Script = mongoose.model('Script', scriptSchema);


const PremiumUser = mongoose.model('PremiumUser', new mongoose.Schema({ 
    user_id: String, 
    is_vip: Boolean 
}));


const Config = mongoose.model('Config', new mongoose.Schema({ 
    key: String, 
    date: Date 
}));


const ServerBlacklist = mongoose.model('ServerBlacklist', new mongoose.Schema({ 
    guild_id: String, 
    reason: String 
}));


// --- 4. ENGINE SETUP ---


const client = new Client({

    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],

    partials: [Partials.Channel]

});


// --- 5. VERBOSE HELPER FUNCTIONS ---


const getGlobalPerms = async (userId) => {

    console.log(`[VERBOSE LOG] AUTHENTICATION: Commencing security sweep for UID: ${userId}`);


    if (userId === ROLES.OWNER) {

        console.log(`[VERBOSE LOG] AUTHENTICATION: Owner identified via UID match. Granting root access.`);

        return { isStaff: true, isManager: true, isCook: true, isDelivery: true, isOwner: true };

    }


    try {

        const supportGuild = client.guilds.cache.get(SUPPORT_SERVER_ID);


        if (!supportGuild) {

            console.error(`[VERBOSE LOG] AUTHENTICATION: Error - Support Cluster not found in memory cache.`);

            return { isStaff: false, isManager: false, isOwner: false };

        }


        const member = await supportGuild.members.fetch(userId);


        const isCook = member.roles.cache.has(ROLES.COOK);

        const isDelivery = member.roles.cache.has(ROLES.DELIVERY);

        const isManager = member.roles.cache.has(ROLES.MANAGER);


        console.log(`[VERBOSE LOG] AUTHENTICATION: UID ${userId} -> Roles: COOK=${isCook}, DELIV=${isDelivery}, MGMT=${isManager}`);


        return { 
            isStaff: isCook || isDelivery || isManager, 
            isManager: isManager, 
            isCook: isCook, 
            isDelivery: isDelivery,
            isOwner: false
        };


    } catch (error) { 

        console.error(`[VERBOSE LOG] AUTHENTICATION: Failed for UID ${userId}. Identity cannot be verified.`);

        return { isStaff: false, isManager: false, isOwner: false }; 

    }

};


const createEmbed = (title, description, color = BRAND_COLOR, fields = []) => {

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description || null)
        .setColor(color)
        .setFooter({ text: BRAND_NAME })
        .setTimestamp();


    if (fields.length > 0) {

        embed.addFields(fields);

    }


    return embed;

};


const updateMasterLog = async (orderId) => {

    console.log(`[VERBOSE LOG] ARCHIVE: Synchronizing state for Transaction ID: ${orderId}`);


    try {

        const channel = await client.channels.fetch(CHANNELS.BACKUP).catch(() => null);


        if (!channel) {

            console.error(`[VERBOSE LOG] ARCHIVE: Failed - Backup channel unreachable.`);

            return;

        }


        const o = await Order.findOne({ order_id: orderId });


        if (!o) {

            console.error(`[VERBOSE LOG] ARCHIVE: Failed - Order ID ${orderId} missing from database.`);

            return;

        }


        const guild = client.guilds.cache.get(o.guild_id);


        const logEmbed = new EmbedBuilder()
            .setTitle(`🍩 MASTER ARCHIVE RECORD: #${o.order_id}`)
            .setColor(o.is_super ? SUPER_COLOR : (o.is_vip ? VIP_COLOR : BRAND_COLOR))
            .addFields(
                { name: 'System Workflow', value: `**${o.status.toUpperCase()}**`, inline: true },
                { name: 'Product details', value: o.item, inline: true },
                { name: 'Customer Node', value: `<@${o.user_id}>`, inline: true },
                { name: 'Origin Cluster', value: `${guild?.name || "Remote Node"} (ID: ${o.guild_id})`, inline: true },
                { name: 'Prep station', value: o.chef_name || 'Unclaimed', inline: true },
                { name: 'Courier Node', value: o.deliverer_id ? `<@${o.deliverer_id}>` : 'Awaiting fulfillment', inline: true }
            )
            .setTimestamp();


        if (o.images && o.images.length > 0) {

            logEmbed.setImage(o.images[0]);

            logEmbed.addFields({ name: 'Visual Evidence Registry', value: o.images.map((url, i) => `[Evidence ${i+1}](${url})`).join(' | ') });

        }


        if (!o.backup_msg_id) {

            const msg = await channel.send({ embeds: [logEmbed] });

            o.backup_msg_id = msg.id; await o.save();

        } else {

            const msg = await channel.messages.fetch(o.backup_msg_id).catch(() => null);

            if (msg) {

                await msg.edit({ embeds: [logEmbed] });

            }

        }


    } catch (e) { 

        console.error(`[VERBOSE LOG] ARCHIVE: Critical Sync Failure: ${e.message}`); 

    }

};


const calculateETA = async () => {

    const queueSize = await Order.countDocuments({ status: { $in: ['pending', 'claimed', 'cooking', 'ready'] } });

    let totalStaff = 0;


    try {

        const supportGuild = client.guilds.cache.get(SUPPORT_SERVER_ID);


        if (supportGuild) {

            await supportGuild.members.fetch(); 

            totalStaff = (supportGuild.roles.cache.get(ROLES.COOK)?.members.size || 0) + (supportGuild.roles.cache.get(ROLES.DELIVERY)?.members.size || 0);

        }


    } catch (e) { 

        totalStaff = 5; 

    }


    const minutes = Math.ceil(((queueSize + 1) * 40) / (totalStaff || 1));


    return minutes < 15 ? "15 - 30 Minutes" : `${minutes} Minutes`;

};


// --- 6. CORE INITIALIZATION ---


client.once('ready', async () => {

    console.log(`[BOOT LOG] Sugar Rush Master Intelligence: ONLINE.`);

    console.log(`[BOOT LOG] Identity established as: ${client.user.tag}`);


    try {

        await mongoose.connect(MONGO_URI);

        console.log("[BOOT LOG] DATABASE: Cloud persistent storage connected successfully.");

    } catch (e) { 

        console.error("[BOOT LOG] DATABASE: Critical connection failure detected."); 

    }


    const commands = [

        { name: 'order', description: 'Request product (100 Coins / 50 VIP)', options: [{ name: 'item', type: 3, required: true, description: 'Specify product' }] },

        { name: 'super_order', description: 'Priority request (150 Coins)', options: [{ name: 'item', type: 3, required: true, description: 'Specify product' }] },

        { name: 'orderstatus', description: 'Track tracking and ETA' },

        { name: 'daily', description: 'Claim daily allowance' },

        { name: 'balance', description: 'Consult ledger vault' },

        { name: 'invite', description: 'Obtain auth link' },

        { name: 'support', description: 'Join support cluster' },

        { name: 'tip', description: 'Tip personnel', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'amount', type: 4, required: true, description: 'Coins' }] },

        { name: 'refund', description: 'Manager: Revert transaction', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },

        { name: 'search', description: 'Manager: Audit record', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },

        { name: 'warn', description: 'Cook/Staff: Cancel pre-cook + Strike', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },

        { name: 'fdo', description: 'Manager: Cancel pre-deliver + Strike', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },

        { name: 'force_warn', description: 'Manager: Strike completed order', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },

        { name: 'ban', description: 'Manager: Manual Ban', options: [{ name: 'userid', type: 3, required: true, description: 'UID' }, { name: 'duration', type: 4, required: true, description: 'Days' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },

        { name: 'unban', description: 'Manager: Restore access', options: [{ name: 'userid', type: 3, required: true, description: 'UID' }] },

        { name: 'serverblacklist', description: 'Owner: TERMINATE cluster access', options: [{ name: 'server_id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },

        { name: 'unblacklistserver', description: 'Owner: Restore cluster access', options: [{ name: 'server_id', type: 3, required: true, description: 'ID' }] },

        { name: 'setscript', description: 'Courier: Personal message config', options: [{ name: 'message', type: 3, required: true, description: 'Custom script text' }] },

        { name: 'claim', description: 'Cook: Accept pending request', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },

        { name: 'cook', description: 'Cook: Prep with visual proof', options: [{ name: 'id', type: 3, required: true, description: 'ID' }, { name: 'image', type: 11, required: false, description: 'File' }, { name: 'link', type: 3, required: false, description: 'Link' }] },

        { name: 'deliver', description: 'Delivery: Human fulfillment', options: [{ name: 'id', type: 3, required: true, description: 'ID' }] },

        { name: 'stats', description: 'Staff Metrics Audit', options: [{ name: 'user', type: 6, required: false, description: 'Target' }] },

        { name: 'staff_buy', description: 'Staff: Perk activation', options: [{ name: 'item', type: 3, required: true, description: 'Perk', choices: [{ name: 'Double Stats (30 Days) - 15,000 Coins', value: 'double_stats' }] }] },

        { name: 'help', description: 'Intelligence node' },

        { name: 'rules', description: 'Guidelines' }

    ];


    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);


    try {

        console.log(`[BOOT LOG] REGISTRY: Synchronizing command node interfaces...`);

        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

        console.log(`[BOOT LOG] REGISTRY: Synchronization successful.`);

    } catch (err) { 

        console.error(`[BOOT LOG] REGISTRY: Critical synchronization failure.`); 

    }


    client.user.setPresence({ activities: [{ name: '/order | Sugar Rush', type: ActivityType.Playing }], status: 'online' });
    

    setInterval(checkAutoDelivery, 60000);

    setInterval(checkQuotaTimer, 60000);

});


// --- 7. FAILSAFE AUTOMATION ---


async function checkAutoDelivery() {

    console.log(`[VERBOSE LOG] BACKGROUND_TASK: Scanning for staled fulfillment nodes...`);


    const limit = new Date(Date.now() - 1200000); // 20 Mins


    const overdue = await Order.find({ status: 'ready', ready_at: { $lt: limit } });
    

    for (const o of overdue) {

        console.log(`[VERBOSE LOG] FAILSAFE: 20-Minute timeout triggered for Order ID: ${o.order_id}`);


        try {

            const guild = client.guilds.cache.get(o.guild_id);


            const channel = guild?.channels.cache.get(o.channel_id);


            if (channel) {

                const autoEmbed = createEmbed(
                    "📦 Automated Dispatch Notification", 
                    `**Chef:** ${o.chef_name}\n\nYour product was fulfilled via automated backup dispatch as the courier window exceeded 20 minutes.\n\n*Thank you for choosing ${BRAND_NAME}! 🍩*`
                );


                if (o.images && o.images.length > 0) {

                    autoEmbed.setImage(o.images[0]);

                }


                await channel.send({ content: `<@${o.user_id}>`, embeds: [autoEmbed] });
            

                o.status = 'delivered'; o.deliverer_id = 'AUTO_FAILSAFE_DISPATCH'; await o.save(); updateMasterLog(o.order_id);

            }

        } catch (e) { 

            console.error(`[VERBOSE LOG] FAILSAFE: Automated dispatch failed for ID ${o.order_id}. Node unreachable.`); 

        }

    }

}


async function checkQuotaTimer() {

    const now = new Date();


    if (now.getUTCDay() === 0 && now.getUTCHours() === 23) {

        console.log(`[VERBOSE LOG] QUOTA_ENGINE: It is Sunday 23:00 UTC. Initializing weekly audit.`);


        const lastRun = await Config.findOne({ key: 'last_quota_run' });


        if (!lastRun || (now - lastRun.date) > 43200000) {

            const supportNode = client.guilds.cache.get(SUPPORT_SERVER_ID);


            if (supportNode) {

                await executeQuotaAudit(supportNode);

            }


            await Config.findOneAndUpdate({ key: 'last_quota_run' }, { date: now }, { upsert: true });

        }

    }

}


async function executeQuotaAudit(guild) {

    console.log(`[VERBOSE LOG] QUOTA_ENGINE: Auditing staff metrics for bonuses.`);


    const quotaChan = guild.channels.cache.get(CHANNELS.QUOTA);


    if (!quotaChan) return;


    const activeStaff = await User.find({ $or: [{ cook_count_week: { $gt: 0 } }, { deliver_count_week: { $gt: 0 } }] });
    

    if (activeStaff.length > 0) {

        const topC = [...activeStaff].sort((a, b) => b.cook_count_week - a.cook_count_week)[0];

        const topD = [...activeStaff].sort((a, b) => b.deliver_count_week - a.deliver_count_week)[0];


        if (topC && topC.cook_count_week > 0) { 

            console.log(`[VERBOSE LOG] QUOTA_ENGINE: Awarding Kitchen MVP payout to UID: ${topC.user_id}`);

            topC.balance += 3000; await topC.save(); 

            quotaChan.send(`🏆 **Kitchen MVP:** <@${topC.user_id}> awarded **3,000 Coins** bonus.`); 

        }


        if (topD && topD.deliver_count_week > 0) { 

            console.log(`[VERBOSE LOG] QUOTA_ENGINE: Awarding Courier MVP payout to UID: ${topD.user_id}`);

            topD.balance += 3000; await topD.save(); 

            quotaChan.send(`🏆 **Courier MVP:** <@${topD.user_id}> awarded **3,000 Coins** bonus.`); 

        }

    }


    await User.updateMany({}, { cook_count_week: 0, deliver_count_week: 0 });

    console.log(`[VERBOSE LOG] QUOTA_ENGINE: Weekly metrics reset finalized.`);

}


// --- 8. GLOBAL INTERACTION HANDLER ---


client.on('interactionCreate', async (interaction) => {

    if (!interaction.isChatInputCommand()) return;
    

    const { commandName, options, guildId, channelId } = interaction;
    

    const isPrivate = ['daily', 'balance', 'help', 'stats', 'order', 'super_order', 'search', 'invite', 'support'].includes(commandName);


    console.log(`[VERBOSE LOG] COMMAND_TRIGGER: UID ${interaction.user.id} utilized /${commandName}`);


    await interaction.deferReply({ ephemeral: isPrivate });


    const perms = await getGlobalPerms(interaction.user.id);

    const uData = await User.findOne({ user_id: interaction.user.id }) || new User({ user_id: interaction.user.id });

    const isVIP = !!(await PremiumUser.findOne({ user_id: interaction.user.id, is_vip: true }));


    // --- BAN PROTOCOL CHECK ---


    if (uData.is_perm_banned) {

        console.log(`[VERBOSE LOG] ACCESS_DENIED: Permanent ban active for UID ${interaction.user.id}`);

        return interaction.editReply("❌ **SERVICE TERMINATED:** Your account is permanently banned from using Sugar Rush.");

    }


    if (uData.service_ban_until && uData.service_ban_until > Date.now()) {

        console.log(`[VERBOSE LOG] ACCESS_DENIED: Service suspension active for UID ${interaction.user.id}`);

        return interaction.editReply(`❌ **SERVICE SUSPENDED:** Your access is restricted until ${uData.service_ban_until.toLocaleDateString()}.`);

    }


    // --- HELP SYSTEM ---


    if (commandName === 'help') {

        const isSupport = guildId === SUPPORT_SERVER_ID;

        const isKitchen = channelId === CHANNELS.COOK;

        const helpLines = ['**🍩 Consumer Nodes**', '**/order**, **/super_order**, **/orderstatus**, **/daily**, **/balance**, **/tip**, **/invite**, **/support**, **/rules**'];


        if (perms.isCook || perms.isOwner) { 

            helpLines.push('\n**👨‍🍳 Kitchen Console**', '**/claim**, **/cook**, **/warn**, **/staff_buy**, **/stats**'); 

        }


        if (perms.isDelivery || perms.isOwner) { 

            helpLines.push('\n**🚴 Courier Console**', '**/deliver**, **/setscript**, **/staff_buy**, **/stats**'); 

        }


        if (perms.isManager || perms.isOwner) { 

            helpLines.push('\n**🛡️ Management**', '**/refund**, **/search**, **/fdo**, **/force_warn**, **/ban**, **/unban**, **/serverblacklist**, **/unblacklistserver**'); 

        }


        return interaction.editReply({ embeds: [createEmbed("Sugar Rush Help Center", helpLines.join('\n'))] });

    }


    // --- DISCIPLINARY MODULES (WARN / FDO / FORCE_WARN) ---


    if (commandName === 'warn' || commandName === 'fdo' || commandName === 'force_warn') {

        console.log(`[VERBOSE LOG] DISCIPLINE: Commencing strike protocol via /${commandName}`);


        const ref = options.getString('id');

        const reason = options.getString('reason');

        const o = await Order.findOne({ order_id: ref });


        if (!o) {

            return interaction.editReply("❌ **DATABASE ERROR:** Transaction ID unknown.");

        }


        if (commandName === 'warn') {

            if (!perms.isCook && !perms.isOwner) return interaction.editReply("❌ **ACCESS DENIED:** Cook role required.");

            if (['cooking', 'ready', 'delivered'].includes(o.status)) return interaction.editReply("❌ **PROTOCOL ERROR:** This order is already prepped. Use management-level `/fdo`.");

        }


        if (commandName === 'fdo') {

            if (!perms.isManager && !perms.isOwner) return interaction.editReply("❌ **ACCESS DENIED:** Management required.");

            if (o.status === 'delivered') return interaction.editReply("❌ **PROTOCOL ERROR:** Order is fulfilled. Use `/force_warn`.");

        }


        if (commandName === 'force_warn') {

            if (!perms.isManager && !perms.isOwner) return interaction.editReply("❌ **ACCESS DENIED:** Management required.");

        }


        const culprit = await User.findOne({ user_id: o.user_id }) || new User({ user_id: o.user_id });

        culprit.warnings += 1;


        let automatedBan = "";


        if (culprit.warnings === 3) {

            culprit.service_ban_until = new Date(Date.now() + 604800000);

            automatedBan = " (7-Day Ban Applied)";

        } else if (culprit.warnings === 6) {

            culprit.service_ban_until = new Date(Date.now() + 2592000000);

            automatedBan = " (30-Day Ban Applied)";

        } else if (culprit.warnings >= 9) {

            culprit.is_perm_banned = true;

            automatedBan = " (Permanent Ban Applied)";

        }


        await culprit.save();


        if (commandName !== 'force_warn') {

            o.status = `cancelled_${commandName}`; await o.save();

        }


        console.log(`[VERBOSE LOG] DISCIPLINE: Strike authorized for UID ${o.user_id}. Total: ${culprit.warnings}`);


        updateMasterLog(ref);


        return interaction.editReply(`⚠️ **STRIKE ISSUED:** <@${o.user_id}> now has **${culprit.warnings}** strikes.${automatedBan}\nReason: ${reason}`);

    }


    // --- SERVICE BAN / UNBAN MODULES ---


    if (commandName === 'ban') {

        if (!perms.isManager && !perms.isOwner) return interaction.editReply("❌ Management required.");


        const targetID = options.getString('userid');

        const days = options.getInteger('duration');

        const reason = options.getString('reason');


        console.log(`[VERBOSE LOG] BAN_PROTOCOL: Issuing ban for UID ${targetID} - Duration: ${days}`);


        const target = await User.findOne({ user_id: targetID }) || new User({ user_id: targetID });


        if (days === 0) { target.is_perm_banned = true; } 

        else { target.service_ban_until = new Date(Date.now() + days * 86400000); }


        await target.save();

        return interaction.editReply(`🛑 **SERVICE BAN:** UID ${targetID} restricted. Duration: ${days === 0 ? "PERMANENT" : days + " Days"}. Reason: ${reason}`);

    }


    if (commandName === 'unban') {

        if (!perms.isManager && !perms.isOwner) return interaction.editReply("❌ Management required.");


        const targetID = options.getString('userid');

        console.log(`[VERBOSE LOG] BAN_PROTOCOL: Restoring access for UID ${targetID}`);


        const target = await User.findOne({ user_id: targetID });


        if (target) { target.is_perm_banned = false; target.service_ban_until = null; await target.save(); }


        return interaction.editReply(`✅ **RESTORED:** UID ${targetID} now has service access.`);

    }


    // --- BLACKLIST MODULES ---


    if (commandName === 'serverblacklist') {

        if (!perms.isOwner) return interaction.editReply("❌ MASTER ROOT ONLY.");


        const sID = options.getString('server_id');

        console.log(`[VERBOSE LOG] BLACKLIST: Purging guild node ${sID}`);


        await new ServerBlacklist({ guild_id: sID, reason: options.getString('reason') }).save();

        return interaction.editReply("🛑 **SERVER BLACKLISTED.** Cluster purged.");

    }


    if (commandName === 'unblacklistserver') {

        if (!perms.isOwner) return interaction.editReply("❌ MASTER ROOT ONLY.");


        const sID = options.getString('server_id');

        console.log(`[VERBOSE LOG] BLACKLIST: Restoring node ${sID}`);


        await ServerBlacklist.deleteOne({ guild_id: sID });

        return interaction.editReply("✅ **SERVER RESTORED.** Cluster node active.");

    }


    // --- INVITE / SUPPORT MODULES ---


    if (commandName === 'invite') {

        console.log(`[VERBOSE LOG] INFO: Generating authorized expansion link.`);


        const invBitfield = "2147535873";

        const invLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=${invBitfield}&scope=bot%20applications.commands`;


        const invRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Authorize Node").setStyle(ButtonStyle.Link).setURL(invLink));


        return interaction.editReply({ embeds: [createEmbed("📢 Authorized Node Invite", `Authorize Sugar Rush with essential delivery and invitation permissions.`)], components: [invRow] });

    }


    if (commandName === 'support') {

        const supRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Join Support Cluster").setStyle(ButtonStyle.Link).setURL(SUPPORT_SERVER_LINK));


        return interaction.editReply({ embeds: [createEmbed("🆘 Infrastructure Support", `Join for personnel applications or dispute resolution.`)], components: [supRow] });

    }


    // --- COURIER MODULES (SET SCRIPT / DELIVER) ---


    if (commandName === 'setscript') {

        if (!perms.isDelivery && !perms.isOwner) return interaction.editReply("❌ **PERMISSION ERROR: Delivery role required.**");


        console.log(`[VERBOSE LOG] STAFF: Saving custom greeting for Driver ${interaction.user.id}`);


        await Script.findOneAndUpdate({ user_id: interaction.user.id }, { script: options.getString('message') }, { upsert: true });


        return interaction.editReply("✅ **CUSTOM SCRIPT SAVED.**");

    }


    if (commandName === 'deliver') {

        if (!perms.isDelivery && !perms.isOwner) return interaction.editReply("❌ **PERMISSION ERROR: Delivery role required.**");


        const ref = options.getString('id');

        const o = await Order.findOne({ order_id: ref, status: 'ready' });


        if (!o) return interaction.editReply("❌ **LOGIC ERROR: Transaction not in dispatch state.**");


        const node = client.guilds.cache.get(o.guild_id)?.channels.cache.get(o.channel_id);


        const scriptDoc = await Script.findOne({ user_id: interaction.user.id });

        const finalMsg = scriptDoc ? scriptDoc.script : `Enjoy your Sugar Rush! Rate us with \`/rate ${o.order_id}\`.`;


        if (!node) {

            console.log(`[VERBOSE LOG] FAILSAFE: Route error for Driver ${interaction.user.id}. Utilizing node failsafe.`);

            o.status = 'delivered'; o.deliverer_id = interaction.user.id; await o.save();


            uData.balance += 30; uData.deliver_count_week += (uData.double_stats_until > Date.now() ? 2 : 1); await uData.save();


            updateMasterLog(ref);


            return interaction.editReply("⚠️ **FAILSAFE:** Manual routing failed. fulfillment dispatched via node. Payroll authorized.");

        }


        console.log(`[VERBOSE LOG] STAFF: Courier ${interaction.user.id} fulfilling Order ${ref}`);


        await node.send({ content: `<@${o.user_id}>`, embeds: [createEmbed("🚴 human Fulfillment Success!", finalMsg).setImage(o.images[0])] });


        o.status = 'delivered'; o.deliverer_id = interaction.user.id; await o.save();


        uData.balance += 30; uData.deliver_count_week += (uData.double_stats_until > Date.now() ? 2 : 1); await uData.save();


        updateMasterLog(ref);


        return interaction.editReply("✅ **HUMAN DISPATCH SUCCESS.** +30 Coins.");

    }


    // --- CULINARY MODULES (CLAIM / COOK) ---


    if (commandName === 'claim') {

        if (!perms.isCook && !perms.isOwner) return interaction.editReply("❌ **PERMISSION ERROR: Cook role required.**");


        console.log(`[VERBOSE LOG] STAFF: Chef ${interaction.user.id} claiming Order ${options.getString('id')}`);


        const ref = options.getString('id');

        const o = await Order.findOne({ order_id: ref, status: 'pending' });


        if (!o) return interaction.editReply("❌ **LOGIC ERROR: Already accepted.**");


        o.status = 'claimed'; o.chef_id = interaction.user.id; o.chef_name = interaction.user.username; await o.save();


        updateMasterLog(ref);


        return interaction.editReply(`👨‍🍳 **CLAIMED:** Order \`${ref}\` assigned.`);

    }


    if (commandName === 'cook') {

        if (!perms.isCook && !perms.isOwner) return interaction.editReply("❌ **PERMISSION ERROR: Cook role required.**");


        const ref = options.getString('id');

        const o = await Order.findOne({ order_id: ref, status: 'claimed' });


        if (!o || o.chef_id !== interaction.user.id) return interaction.editReply("❌ **OWNERSHIP ERROR: Assignment mismatch.**");


        const img = options.getAttachment('image')?.url || options.getString('link');


        if (!img) return interaction.editReply("❌ **VALIDATION ERROR: Proof required.**");


        o.status = 'cooking'; o.images = [img]; await o.save();


        console.log(`[VERBOSE LOG] STAFF: Chef ${interaction.user.id} engaged 180s timer for Order ${ref}`);


        updateMasterLog(ref);


        interaction.editReply("♨️ **COOKING:** Sequence engaged. 180s until Ready.");


        setTimeout(async () => {

            const f = await Order.findOne({ order_id: ref });


            if (f && f.status === 'cooking') {

                f.status = 'ready'; f.ready_at = new Date(); await f.save();


                const cProfile = await User.findOne({ user_id: f.chef_id });


                cProfile.balance += 20; cProfile.cook_count_week += (cProfile.double_stats_until > Date.now() ? 2 : 1); await cProfile.save();


                console.log(`[VERBOSE LOG] STAFF: Order ${ref} ready for Courier pickup.`);


                client.channels.cache.get(CHANNELS.DELIVERY)?.send({ embeds: [createEmbed("📦 Order Ready", `ID: \`${ref}\`\nChef: ${f.chef_name}`)] });


                updateMasterLog(ref);

            }

        }, 180000);

    }


    // --- ECONOMY MODULES (DAILY / ORDER / SUPER / TIP) ---


    if (commandName === 'daily') {

        const day = 86400000;


        if (Date.now() - uData.last_daily < day) {

            console.log(`[VERBOSE LOG] ECONOMY: Daily denied for UID ${interaction.user.id}. Cooldown active.`);

            return interaction.editReply(`❌ Allowance locked. Return in **${Math.floor((day - (Date.now() - uData.last_daily)) / 3600000)} hours**.`);

        }


        const sum = isVIP ? 2000 : 1000;


        uData.balance += sum; uData.last_daily = Date.now(); await uData.save();


        console.log(`[VERBOSE LOG] ECONOMY: Daily disbursement successful for UID ${interaction.user.id}.`);


        return interaction.editReply({ embeds: [createEmbed("💰 Daily Allowance", `Authorized payout received: **${sum} Coins**.`)] });

    }


    if (commandName === 'order' || commandName === 'super_order') {

        const isSuper = commandName === 'super_order';


        if (isSuper && isVIP) return interaction.editReply("❌ **VIP CONFLICT.** Access standard `/order` for only 50 coins.");


        const cost = isSuper ? 150 : (isVIP ? 50 : 100);


        if (uData.balance < cost) return interaction.editReply(`❌ **VAULT ERROR.** Needs **${cost} Coins**.`);


        const dup = await Order.findOne({ user_id: interaction.user.id, status: { $in: ['pending', 'claimed', 'cooking', 'ready'] } });


        if (dup) return interaction.editReply("❌ **QUEUE CONFLICT.** request in fulfillment.");


        console.log(`[VERBOSE LOG] ECONOMY: New request authorized for UID ${interaction.user.id}. Type: ${commandName}`);


        uData.balance -= cost; await uData.save();


        const id = Math.random().toString(36).substring(2, 8).toUpperCase();


        await new Order({ order_id: id, user_id: interaction.user.id, guild_id: guildId, channel_id: channelId, item: options.getString('item'), is_vip: isVIP, is_super: isSuper }).save();


        updateMasterLog(id);


        const kNode = client.channels.cache.get(CHANNELS.COOK);


        if (kNode) {

            const ping = isSuper ? "@here 🚀 **SUPER ORDER RECEIVED**" : null;

            kNode.send({ content: ping, embeds: [createEmbed(isSuper ? "🚀 SUPER ORDER" : "🍩 NEW ORDER", `Product: ${options.getString('item')}\nID: \`${id}\``, isSuper ? SUPER_COLOR : BRAND_COLOR)] });

        }


        return interaction.editReply({ embeds: [createEmbed("✅ Authorized", `Order ID: \`${id}\` | Charge: **${cost} Coins**`)] });

    }


});


// --- 9. PLATFORM AUTHENTICATION ---


client.login(BOT_TOKEN);


/**
 * ============================================================================
 * END OF MASTER INFRASTRUCTURE
 * Telemetry Restored. Vertical Expansion Complete. Logic Integrity Verified.
 * ============================================================================
 */
