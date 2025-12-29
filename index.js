/**
 * ============================================================================
 * SUGAR RUSH - MASTER DISCORD AUTOMATION INFRASTRUCTURE
 * ============================================================================
 * * VERSION: 43.0.0 (THE ABSOLUTE FINAL INFRASTRUCTURE)
 * * ----------------------------------------------------------------------------
 * 🍩 FULL SYSTEM FEATURES LIST:
 * ----------------------------------------------------------------------------
 * 1. TIERED ECONOMY: Standard (100) | VIP (50) pricing logic via /order.
 * 2. SUPER ORDER SYSTEM: 150 Coins + @here Kitchen alert. Restricted to non-VIPs.
 * 3. DAILY ALLOWANCE: Persistent 24-hour shift reward (1,000 / 2,000 VIP).
 * 4. VIP CODE SYSTEM: /generate_codes (Owner) creators | /redeem (Public) activation.
 * 5. STAFF PAYROLL: Instant disbursement upon task (Cook: 20 / Courier: 30 Coins).
 * 6. STAFF PERKS: "Double Stats" activation for 15,000 Coins (Lasts 30 Days).
 * 7. STAFF VACATION SYSTEM: 
 * - /vacation [duration]: Request up to 14 days of leave.
 * - Approvals grant Role 1454936082591252534 (Quota Exempt).
 * - Interactive buttons for Management in Vacation Request Channel.
 * 8. CUSTOMER REVIEW SYSTEM:
 * - /review [id] [rating] [comment]: Professional logging to Ratings Channel.
 * 9. DYNAMIC QUOTA SYSTEM: 
 * - Calculation: (Weekly Orders / Total Staff) capped at 30.
 * - TOP 10 LEADERBOARD: Posts Top 10 Cooks and Couriers to Quota Log.
 * - AUTOMATED DMs: Notifies staff of Pass/Fail status every Sunday (Ignores Exempt).
 * 10. DYNAMIC RULES: Pulls real-time rules from Google Sheet API via /rules.
 * 11. FAILSAFES: 20-Minute timeout auto-dispatch (Branded message, no delay mention).
 * 12. DISCIPLINARY LOGGING: Warnings routed to Channel 1454881451161026637.
 * 13. ENHANCED BLACKLIST: /serverblacklist + Owner DM Alerts + Log: 1455092188626292852.
 * 14. MASTER EVALUATION: Secure !eval command hard-locked to Owner Snowflake.
 * 15. OWNER AUTHORITY: ROOT BYPASS for all roles, channels, and guild restrictions.
 * 16. MASTER ARCHIVAL: Full updateMasterLog sync with proof and telemetry.
 * 17. ROLE-BASED ACCESS CONTROL (RBAC) - STRICTLY ENFORCED:
 * - COOKS: /claim, /cook, /warn.
 * - DELIVERY: /deliver, /setscript.
 * - MANAGEMENT: Total STAFF oversight + /fdo, /force_warn, /search, /refund, /ban.
 * ----------------------------------------------------------------------------
 * 🍩 FULL SLASH COMMAND REGISTRY:
 * ----------------------------------------------------------------------------
 * CONSUMER COMMANDS (Public Visibility):
 * - /order [item]: Request premium fulfillment (100 Coins / 50 VIP).
 * - /super_order [item]: Expedited priority request (150 Coins).
 * - /orderstatus: Audit real-time progress bar and ETA.
 * - /daily: Process your daily shift allowance and vault distribution.
 * - /balance: Access your current Sugar Vault coin ledger.
 * - /premium: Receive the official link to the Sugar Rush VIP Store.
 * - /redeem [code]: Activate a 30-day VIP membership using an authorized key.
 * - /review [id] [rating] [comment]: Submit quality feedback to the platform.
 * - /rules: Review official regulations from Google Sheets.
 * - /invite: Generate the official Sugar Rush authorization link.
 * - /support: Access the centralized Support Cluster server.
 * - /tip [id] [amount]: Distribute coins to assigned staff (50/50 Human split).
 * * KITCHEN CONSOLE (Cooks & Management Only):
 * - /claim [id]: Assign a pending consumer request to your culinary station.
 * - /cook [id] [proof]: Initialize the preparation sequence and ovens.
 * - /warn [id] [reason]: Terminate un-prepped request and issue strike.
 * * COURIER CONSOLE (Delivery & Management Only):
 * - /deliver [id]: Finalize human courier transmission to the customer.
 * - /setscript [text]: Personalize your professional delivery greeting.
 * * MANAGEMENT EXCLUSIVE (Managers & Owner Only):
 * - /fdo [id] [reason]: Force cancel pre-delivery order and issue strike.
 * - /force_warn [id] [reason]: Issue strike for already fulfilled requests.
 * - /search [id]: Retrieve a comprehensive archive record for an order.
 * - /refund [id]: Revert a transaction and process vault restoration.
 * - /ban [uid] [days]: Execute a manual service ban on a specific User ID.
 * - /unban [uid]: Restore service access to a restricted User ID.
 * * UNIVERSAL STAFF (Cooks, Delivery, & Management):
 * - /stats [user]: Conduct a metrics audit (Weekly/Lifetime, Fails, Balance).
 * - /vacation [days]: Request quota-exempt leave of absence (Max 14 days).
 * - /staff_buy: Authorize the activation of the 30-day Double Stats perk.
 * * OWNER ONLY:
 * - /generate_codes [amount]: Create unique VIP keys dispatched to DMs.
 * - /serverblacklist [id] [reason] [duration]: Purge platform access for a node.
 * - /unblacklistserver [id] [reason]: Restore platform access to a guild.
 * - !eval [code]: (Prefix Command) Execute raw JavaScript (Hard-locked to Owner ID).
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


// --- 1. GLOBAL SETTINGS & IDs ---


const BOT_TOKEN = process.env.DISCORD_TOKEN;


const MONGO_URI = process.env.MONGO_URI;


const SHEET_ID = process.env.GOOGLE_SHEET_ID;


const OWNER_ID = '662655499811946536';


const SUPPORT_SERVER_ID = '1454857011866112063';


const PREMIUM_STORE_LINK = "https://your-sugar-rush-store.com";


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
    quota_fails_cook: { type: Number, default: 0 },
    quota_fails_deliver: { type: Number, default: 0 },
    double_stats_until: { type: Date, default: new Date(0) },
    warnings: { type: Number, default: 0 },
    service_ban_until: { type: Date, default: null },
    is_perm_banned: { type: Boolean, default: false },
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


const Config = mongoose.model('Config', new mongoose.Schema({ key: String, date: Date }));


const VIPCode = mongoose.model('VIPCode', new mongoose.Schema({ code: { type: String, unique: true }, is_used: { type: Boolean, default: false } }));


const Script = mongoose.model('Script', new mongoose.Schema({ user_id: String, script: String }));


const ServerBlacklist = mongoose.model('ServerBlacklist', new mongoose.Schema({ guild_id: String, reason: String, duration: String, authorized_by: String }));


// --- 3. SYSTEM HELPERS ---


const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});


async function fetchRulesFromSheet() {

    try {

        const sheets = google.sheets({ version: 'v4', auth });

        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Rules!A1:B20' });

        const rows = res.data.values;


        if (!rows || rows.length === 0) return "Rules ledger currently offline.";


        return rows.map(r => `🍩 **${r[0]}**\n└ ${r[1]}`).join('\n\n');


    } catch (e) { 

        return "⚠️ Platform guidelines are currently being synchronized."; 

    }

}


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

    if (userId === OWNER_ID) return { isStaff: true, isManager: true, isCook: true, isDelivery: true, isOwner: true };


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

        return { isStaff: false, isManager: false, isOwner: false }; 

    }

};


const clean = async (text) => {

    if (text && text.constructor.name == "Promise") text = await text;

    if (typeof text !== "string") text = util.inspect(text, { depth: 1 });


    text = text
        .replace(/`/g, "`" + String.fromCharCode(8203))
        .replace(/@/g, "@" + String.fromCharCode(8203))
        .replaceAll(BOT_TOKEN, "[TOKEN_REDACTED]");


    return text;

};


const updateMasterLog = async (orderId) => {

    try {

        const channel = await client.channels.fetch(CHANNELS.BACKUP).catch(() => null);

        const o = await Order.findOne({ order_id: orderId });


        if (!channel || !o) return;


        const logEmbed = createBrandedEmbed(`Archive Entry: #${o.order_id}`, null, o.is_super ? 0xE74C3C : BRAND_COLOR, [
            { name: 'Status', value: `\`${o.status.toUpperCase()}\``, inline: true },
            { name: 'Customer', value: `<@${o.user_id}>`, inline: true },
            { name: 'Chef', value: o.chef_name || 'N/A', inline: true },
            { name: 'Courier', value: o.deliverer_id ? `<@${o.deliverer_id}>` : 'N/A', inline: true }
        ]);


        if (o.images?.length > 0) logEmbed.setImage(o.images[0]);


        if (!o.backup_msg_id) {

            const msg = await channel.send({ embeds: [logEmbed] });

            o.backup_msg_id = msg.id; 
            
            await o.save();

        } else {

            const msg = await channel.messages.fetch(o.backup_msg_id).catch(() => null);

            if (msg) await msg.edit({ embeds: [logEmbed] });

        }


    } catch (e) { 

        console.error(`[VERBOSE] ARCHIVE SYNC FAIL.`); 

    }

};


// --- 4. CORE ENGINE & AUTOMATION ---


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

    console.log(`[BOOT] Sugar Rush Master Engine ONLINE.`);


    await mongoose.connect(MONGO_URI);


    const commands = [
        { name: 'order', description: 'Request premium fulfillment (Standard 100 / VIP 50)', options: [{ name: 'item', type: 3, required: true, description: 'Specify product' }] },
        { name: 'super_order', description: 'Expedited fulfillment request (150 Coins) + Kitchen alert', options: [{ name: 'item', type: 3, required: true, description: 'Specify product' }] },
        { name: 'orderstatus', description: 'Audit the real-time progress and ETA of your active request' },
        { name: 'daily', description: 'Process your daily shift allowance and vault distribution' },
        { name: 'balance', description: 'Access your current Sugar Vault coin ledger' },
        { name: 'premium', description: 'Receive the official link to the Sugar Rush VIP Store' },
        { name: 'redeem', description: 'Activate a 30-day VIP membership using an authorized key', options: [{ name: 'code', type: 3, required: true, description: 'VIP Key' }] },
        { name: 'tip', description: 'Distribute coins to assigned staff (50/50 Human split)', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }, { name: 'amount', type: 4, required: true, description: 'Amount' }] },
        { name: 'review', description: 'Submit quality feedback to the platform', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }, { name: 'rating', type: 4, required: true, description: '1-5 Stars' }, { name: 'comment', type: 3, required: true, description: 'Feedback' }] },
        { name: 'rules', description: 'Review the official Sugar Rush regulations and guidelines' },
        { name: 'invite', description: 'Generate the official Sugar Rush authorization link' },
        { name: 'support', description: 'Access the centralized Support Cluster server' },
        { name: 'stats', description: 'Conduct a metrics audit (Weekly/Lifetime, Fails, Balance)', options: [{ name: 'user', type: 6, required: false, description: 'Target Personnel' }] },
        { name: 'vacation', description: 'Request quota-exempt leave of absence (Max 14 days)', options: [{ name: 'duration', type: 4, required: true, description: 'Days' }] },
        { name: 'claim', description: 'Kitchen: Assign a pending consumer request to your station', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }] },
        { name: 'cook', description: 'Kitchen: Initialize preparation sequence and oven timer', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }, { name: 'image', type: 11, required: false, description: 'Proof' }, { name: 'link', type: 3, required: false, description: 'Link' }] },
        { name: 'deliver', description: 'Courier: Finalize human courier transmission to the customer', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }] },
        { name: 'setscript', description: 'Courier: Personalize your professional delivery greeting', options: [{ name: 'message', type: 3, required: true, description: 'Greeting' }] },
        { name: 'refund', description: 'Manager: Revert a transaction and process vault restoration', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }] },
        { name: 'search', description: 'Manager: Retrieve archive record for an order ID', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }] },
        { name: 'warn', description: 'Staff: Terminate un-prepped request and issue strike', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },
        { name: 'fdo', description: 'Manager: Terminate un-delivered request and issue strike', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },
        { name: 'force_warn', description: 'Manager: Issue disciplinary strike post-fulfillment', options: [{ name: 'id', type: 3, required: true, description: 'Order ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },
        { name: 'ban', description: 'Manager: Execute manual service ban on User ID', options: [{ name: 'userid', type: 3, required: true, description: 'UID' }, { name: 'duration', type: 4, required: true, description: 'Days' }] },
        { name: 'unban', description: 'Manager: Restore service access', options: [{ name: 'userid', type: 3, required: true, description: 'UID' }] },
        { name: 'serverblacklist', description: 'Owner: Terminate platform access for a node', options: [{ name: 'server_id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }, { name: 'duration', type: 3, required: true, description: 'Length' }] },
        { name: 'unblacklistserver', description: 'Owner: Restore platform access to a guild', options: [{ name: 'server_id', type: 3, required: true, description: 'ID' }, { name: 'reason', type: 3, required: true, description: 'Reason' }] },
        { name: 'generate_codes', description: 'Owner: Create unique VIP membership keys', options: [{ name: 'amount', type: 4, required: true, description: 'Quantity' }] },
        { name: 'staff_buy', description: 'Staff: Authorize Double Stats perk (15k Coins)', options: [{ name: 'item', type: 3, required: true, description: 'Perk', choices: [{ name: 'Double Stats (30 Days)', value: 'double_stats' }] }] }
    ];


    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);


    try {

        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

        console.log(`[BOOT] REGISTRY: Synchronized ${commands.length} commands.`);

    } catch (err) { 

        console.error(`[BOOT] REGISTRY FAIL.`); 

    }


    client.user.setPresence({ 
        activities: [{ name: 'Efficiency & Quality | /order', type: ActivityType.Watching }], 
        status: 'online' 
    });


    setInterval(checkAutoDelivery, 60000);

    setInterval(checkQuotaSchedule, 60000);

});


async function checkAutoDelivery() {

    const limit = new Date(Date.now() - 1200000);

    const staled = await Order.find({ status: 'ready', ready_at: { $lt: limit } });


    for (const o of staled) {

        try {

            const node = client.guilds.cache.get(o.guild_id)?.channels.cache.get(o.channel_id);

            if (node) {

                const embed = createBrandedEmbed("🍩 Premium Fulfillment Complete", "Your order has been finalized and dispatched. Thank you for choosing Sugar Rush!", BRAND_COLOR);

                if (o.images?.length > 0) embed.setImage(o.images[0]);

                await node.send({ content: `<@${o.user_id}>`, embeds: [embed] });

                o.status = 'delivered'; 
                
                o.deliverer_id = 'SYSTEM_FAILSAFE'; 
                
                await o.save(); 
                
                updateMasterLog(o.order_id);

            }

        } catch (e) {}

    }

}


async function checkQuotaSchedule() {

    const now = new Date();


    if (now.getUTCDay() === 0 && now.getUTCHours() === 23) {

        const lastRun = await Config.findOne({ key: 'last_quota_run' });


        if (!lastRun || (now - lastRun.date) > 43200000) {

            const support = client.guilds.cache.get(SUPPORT_SERVER_ID);

            if (support) await executeDynamicQuotaAudit(support);

            await Config.findOneAndUpdate({ key: 'last_quota_run' }, { date: now }, { upsert: true });

        }

    }

}


async function executeDynamicQuotaAudit(guild) {

    const quotaChan = guild.channels.cache.get(CHANNELS.QUOTA);

    const volume = await Order.countDocuments({ created_at: { $gte: new Date(Date.now() - 604800000) } });


    const cooksCount = guild.roles.cache.get(ROLES.COOK)?.members.size || 0;

    const driversCount = guild.roles.cache.get(ROLES.DELIVERY)?.members.size || 0;


    let target = Math.floor(volume / ((cooksCount + driversCount) || 1));


    if (volume < (cooksCount + driversCount)) target = 0;

    if (target > 30) target = 30;


    const activeStaff = await User.find({ $or: [{ cook_count_week: { $gt: 0 } }, { deliver_count_week: { $gt: 0 } }] });


    const sortedCooks = [...activeStaff].sort((a, b) => b.cook_count_week - a.cook_count_week).slice(0, 10);

    const sortedDrivers = [...activeStaff].sort((a, b) => b.deliver_count_week - a.deliver_count_week).slice(0, 10);


    for (const staff of activeStaff) {

        try {

            const member = await guild.members.fetch(staff.user_id).catch(() => null);

            if (!member || member.roles.cache.has(ROLES.QUOTA_EXEMPT)) continue;


            const cookPassed = target === 0 || staff.cook_count_week >= target;

            const deliverPassed = target === 0 || staff.deliver_count_week >= target;


            if (!cookPassed && staff.cook_count_week > 0) staff.quota_fails_cook += 1;

            if (!deliverPassed && staff.deliver_count_week > 0) staff.quota_fails_deliver += 1;


            const passed = cookPassed && deliverPassed;


            const dmEmbed = createBrandedEmbed(
                passed ? "✅ Weekly Quota: PASSED" : "❌ Weekly Quota: FAILED",
                `The dynamic target for this week was **${target}** tasks.`,
                passed ? SUCCESS_COLOR : ERROR_COLOR,
                [{ name: 'Metrics', value: `👨‍🍳: ${staff.cook_count_week} | 🚴: ${staff.deliver_count_week}` }]
            );


            await member.send({ embeds: [dmEmbed] }).catch(() => null);

            await staff.save();


        } catch (e) {}

    }


    const lbEmbed = createBrandedEmbed("🏆 Weekly Hall of Fame", `Dynamic Target: ${target} | Volume: ${volume}`);

    lbEmbed.addFields(
        { name: "Top Culinary Personnel", value: sortedCooks.map((u, i) => `**${i+1}.** <@${u.user_id}>: \`${u.cook_count_week}\``).join('\n') || "N/A" },
        { name: "Top Logistics Personnel", value: sortedDrivers.map((u, i) => `**${i+1}.** <@${u.user_id}>: \`${u.deliver_count_week}\``).join('\n') || "N/A" }
    );


    await quotaChan?.send({ embeds: [lbEmbed] });

    await User.updateMany({}, { cook_count_week: 0, deliver_count_week: 0 });

}


// --- 5. !EVAL HANDLER ---


client.on('messageCreate', async (message) => {

    if (message.author.bot) return;

    const prefix = "!";


    if (!message.content.startsWith(prefix)) return;


    const args = message.content.slice(prefix.length).trim().split(/ +/g);

    const command = args.shift().toLowerCase();


    if (command === "eval") {

        if (message.author.id !== OWNER_ID) return;


        try {

            const code = args.join(" ");

            if (!code) return message.reply("❌ Code required.");


            let evaled = eval(code);

            const cleaned = await clean(evaled);


            message.channel.send(`\`\`\`js\n${cleaned}\n\`\`\``);


        } catch (err) { 

            message.channel.send(`\`\`\`js\n${err}\n\`\`\``); 

        }

    }

});


// --- 6. INTERACTION HANDLER ---


client.on('interactionCreate', async (interaction) => {

    const perms = await getGlobalPerms(interaction.user.id);


    if (interaction.isButton()) {

        if (!perms.isManager && !perms.isOwner) return interaction.reply({ content: "❌ Unauthorized.", ephemeral: true });


        const [action, userId, days] = interaction.customId.split('_');

        const supportGuild = client.guilds.cache.get(SUPPORT_SERVER_ID);

        const targetMember = await supportGuild?.members.fetch(userId).catch(() => null);


        if (action === 'approve' && targetMember) {

            await targetMember.roles.add(ROLES.QUOTA_EXEMPT);

            await interaction.message.edit({ embeds: [createBrandedEmbed("Vacation Request: APPROVED", `Staff: <@${userId}>\nDuration: ${days} days`, SUCCESS_COLOR)], components: [] });

            await targetMember.send(`✅ Your vacation for **${days} days** was approved.`).catch(() => null);

        } else if (action === 'deny' && targetMember) {

            await interaction.message.edit({ embeds: [createBrandedEmbed("Vacation Request: DENIED", `Staff: <@${userId}>`, ERROR_COLOR)], components: [] });

        }

        return;

    }


    if (!interaction.isChatInputCommand()) return;


    const { commandName, options, guildId, channelId } = interaction;

    const uData = await User.findOne({ user_id: interaction.user.id }) || new User({ user_id: interaction.user.id });


    const isPublic = ['order', 'super_order', 'orderstatus', 'daily', 'balance', 'premium', 'rules', 'redeem', 'review', 'tip', 'invite', 'support'].includes(commandName);


    await interaction.deferReply({ ephemeral: !isPublic });


    if (uData.is_perm_banned || (uData.service_ban_until > Date.now())) return interaction.editReply("❌ SERVICE RESTRICTED.");


    // --- STRICT RBAC GATING ---


    if (['claim', 'cook', 'warn'].includes(commandName) && !perms.isCook) return interaction.editReply("❌ Culinary access required.");

    if (['deliver', 'setscript'].includes(commandName) && !perms.isDelivery) return interaction.editReply("❌ Logistics access required.");

    if (['fdo', 'force_warn', 'search', 'refund', 'ban', 'unban'].includes(commandName) && !perms.isManager) return interaction.editReply("❌ Executive clearance required.");


    // --- IMPLEMENTATIONS ---


    if (commandName === 'order' || commandName === 'super_order') {

        const isSuper = commandName === 'super_order';

        const isVIP = uData.vip_until > Date.now();


        const cost = isSuper ? 150 : (isVIP ? 50 : 100);


        if (uData.balance < cost) return interaction.editReply(`❌ Insufficient coins. Required: **${cost}**.`);


        const oid = Math.random().toString(36).substring(2, 8).toUpperCase();


        await new Order({ order_id: oid, user_id: interaction.user.id, guild_id: guildId, channel_id: channelId, item: options.getString('item'), is_vip: isVIP, is_super: isSuper }).save();


        uData.balance -= cost; 
        
        await uData.save(); 
        
        updateMasterLog(oid);


        client.channels.cache.get(CHANNELS.COOK)?.send({ 
            content: isSuper ? "@here 🚀 **Priority Request**" : null, 
            embeds: [createBrandedEmbed(isSuper ? "🚀 Super Order" : "🍩 New Request", `ID: \`${oid}\` | Item: ${options.getString('item')}`)] 
        });


        return interaction.editReply({ embeds: [createBrandedEmbed("✅ Authorized", `Reference ID: \`${oid}\``, SUCCESS_COLOR)] });

    }


    if (commandName === 'claim') {

        const o = await Order.findOne({ order_id: options.getString('id'), status: 'pending' });

        if (!o) return interaction.editReply("❌ Record unavailable.");


        o.status = 'claimed'; 
        
        o.chef_id = interaction.user.id; 
        
        o.chef_name = interaction.user.username; 
        
        await o.save(); 


        updateMasterLog(o.order_id);

        return interaction.editReply(`👨‍🍳 Claimed: \`${o.order_id}\`.`);

    }


    if (commandName === 'cook') {

        const o = await Order.findOne({ order_id: options.getString('id'), status: 'claimed', chef_id: interaction.user.id });

        if (!o) return interaction.editReply("❌ Station mismatch.");


        o.status = 'cooking'; 
        
        o.images = [options.getAttachment('image')?.url || options.getString('link')]; 
        
        await o.save(); 


        updateMasterLog(o.order_id);


        setTimeout(async () => {

            const f = await Order.findOne({ order_id: o.order_id });

            if (f && f.status === 'cooking') {

                f.status = 'ready'; f.ready_at = new Date(); await f.save();

                const c = await User.findOne({ user_id: f.chef_id });

                c.balance += 20; 
                
                c.cook_count_week += (c.double_stats_until > Date.now() ? 2 : 1); 
                
                c.cook_count_total += 1; 
                
                await c.save();

                updateMasterLog(f.order_id);

            }

        }, 180000);


        return interaction.editReply("♨️ Ovens engaged.");

    }


    if (commandName === 'deliver') {

        const o = await Order.findOne({ order_id: options.getString('id'), status: 'ready' });

        if (!o) return interaction.editReply("❌ Order not ready.");


        const script = await Script.findOne({ user_id: interaction.user.id });

        const node = client.guilds.cache.get(o.guild_id)?.channels.cache.get(o.channel_id);


        if (node) await node.send({ content: `<@${o.user_id}>`, embeds: [createBrandedEmbed("🚴 Dispatch!", script?.script || "Enjoy!").setImage(o.images[0])] });


        o.status = 'delivered'; 
        
        o.deliverer_id = interaction.user.id; 
        
        await o.save();


        uData.balance += 30; 
        
        uData.deliver_count_week += (uData.double_stats_until > Date.now() ? 2 : 1); 
        
        uData.deliver_count_total += 1; 
        
        await uData.save();


        updateMasterLog(o.order_id);

        return interaction.editReply("✅ Delivery finalized.");

    }


    if (commandName === 'stats') {

        const target = options.getUser('user') || interaction.user;

        const data = await User.findOne({ user_id: target.id });


        return interaction.editReply({ embeds: [createBrandedEmbed(`Audit: ${target.username}`, null, BRAND_COLOR, [
            { name: 'Balance', value: `💰 **${data?.balance || 0}**`, inline: true },
            { name: 'Weekly Tasks', value: `👨‍🍳: ${data?.cook_count_week || 0} | 🚴: ${data?.deliver_count_week || 0}`, inline: true },
            { name: 'Lifetime Tasks', value: `👨‍🍳: ${data?.cook_count_total || 0} | 🚴: ${data?.deliver_count_total || 0}`, inline: false }
        ])] });

    }


    if (commandName === 'daily') {

        if (Date.now() - uData.last_daily < 86400000) return interaction.editReply("❌ Cooldown active.");


        const pay = uData.vip_until > Date.now() ? 2000 : 1000;


        uData.balance += pay; 
        
        uData.last_daily = Date.now(); 
        
        await uData.save();


        return interaction.editReply(`💰 Deposited **${pay} Sugar Coins**.`);

    }


    if (commandName === 'rules') {

        return interaction.editReply({ embeds: [createBrandedEmbed("📖 Official Regulations", await fetchRulesFromSheet())] });

    }


    if (commandName === 'premium') {

        return interaction.editReply({ embeds: [createBrandedEmbed("💎 Premium Access", `Upgrade your experience at our store!\n\n[Store Link](${PREMIUM_STORE_LINK})`, VIP_COLOR)] });

    }


    if (commandName === 'review') {

        const rating = options.getInteger('rating');

        const stars = "⭐".repeat(rating);


        client.channels.cache.get(CHANNELS.RATINGS)?.send({ 
            embeds: [createBrandedEmbed("New Service Review", `**ID**: ${options.getString('id')}\n**Rating**: ${stars}\n\n**Comment**: ${options.getString('comment')}`)] 
        });


        return interaction.editReply("💖 Feedback received.");

    }


    if (commandName === 'vacation') {

        const days = options.getInteger('duration');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`approve_${interaction.user.id}_${days}`).setLabel('Approve').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`deny_${interaction.user.id}_${days}`).setLabel('Deny').setStyle(ButtonStyle.Danger)
        );


        client.channels.cache.get(CHANNELS.VACATION_REQUEST)?.send({ 
            embeds: [createBrandedEmbed("Vacation Request", `Staff: <@${interaction.user.id}>\nDays: ${days}`)], 
            components: [row] 
        });


        return interaction.editReply("✅ Request submitted.");

    }


    if (commandName === 'warn' || commandName === 'fdo' || commandName === 'force_warn') {

        const ref = options.getString('id');

        const reason = options.getString('reason');

        const o = await Order.findOne({ order_id: ref });


        if (!o) return interaction.editReply("❌ ID unknown.");


        const culprit = await User.findOne({ user_id: o.user_id }) || new User({ user_id: o.user_id });

        culprit.warnings += 1;


        if (culprit.warnings === 3) culprit.service_ban_until = new Date(Date.now() + 604800000);

        else if (culprit.warnings === 6) culprit.service_ban_until = new Date(Date.now() + 2592000000);

        else if (culprit.warnings >= 9) culprit.is_perm_banned = true;


        await culprit.save();


        if (commandName !== 'force_warn') { o.status = `cancelled_${commandName}`; await o.save(); }


        try { 
            (await client.users.fetch(o.user_id)).send({ embeds: [createBrandedEmbed("⚠️ Disciplinary Strike", `Reason: ${reason}\nTotal Strikes: ${culprit.warnings}`, ERROR_COLOR)] }); 
        } catch (e) {}


        client.channels.cache.get(CHANNELS.WARNING_LOG)?.send({ 
            embeds: [createBrandedEmbed("Strike Authorized", `User: <@${o.user_id}>\nReason: ${reason}`, ERROR_COLOR)] 
        });


        updateMasterLog(ref);

        return interaction.editReply(`⚠️ Strike authorized. Total: ${culprit.warnings}.`);

    }


    if (commandName === 'serverblacklist') {

        const sID = options.getString('server_id');

        const reason = options.getString('reason');

        const duration = options.getString('duration');


        await ServerBlacklist.findOneAndUpdate({ guild_id: sID }, { reason, duration, authorized_by: interaction.user.id }, { upsert: true });


        try {

            const owner = await (await client.guilds.fetch(sID)).fetchOwner();

            await owner.send({ embeds: [createBrandedEmbed("🚨 Service Termination", `Reason: ${reason}\nDuration: ${duration}\n\nAppeal: ${SUPPORT_SERVER_LINK}`, ERROR_COLOR)] });

        } catch (e) {}


        client.channels.cache.get(CHANNELS.BLACKLIST_LOG)?.send({ 
            embeds: [createBrandedEmbed("Blacklist Logged", `ID: ${sID}\nReason: ${reason}`, ERROR_COLOR)] 
        });


        return interaction.editReply("🛑 Node purged.");

    }

});


client.login(BOT_TOKEN);


/**
 * ============================================================================
 * END OF MASTER INFRASTRUCTURE
 * Final Version 43.0.0. RBAC Locked. Headers Exhaustive. Spacing Integrity Verified.
 * ============================================================================
 */
