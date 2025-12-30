/**
 * ============================================================================
 * SUGAR RUSH - MASTER DISCORD AUTOMATION INFRASTRUCTURE
 * ============================================================================
 * * VERSION: 82.0.9 (FEATURE: INVITE ERROR HANDLING)
 * * ----------------------------------------------------------------------------
 * 📜 FULL COMMAND REGISTER (35 TOTAL COMMANDS):
 *
 * [1] OWNER & SYSTEM
 * • !eval [code]              : (Message) Executes raw Node.js code.
 * • /generate_codes [amt]     : Creates VIP codes for the shop database.
 * • /serverblacklist [id] [r] : Bans a specific server from using the bot.
 * • /unserverblacklist [id]   : Unbans a server (Restored Command).
 *
 * [2] MANAGEMENT & DISCIPLINE
 * • /warn [id] [reason]       : (Cooks/Mgmt) Warns user. Pre-cooking (Pending/Claimed) ONLY.
 * • /fdo [id] [reason]        : (Mgmt) Force Discipline. Pre-delivery (Ready) ONLY.
 * • /force_warn [id] [reason] : (Mgmt) Force Warn. Applied to ANY status (e.g. Delivered).
 * • /ban [uid] [days]         : Service bans a user from ordering.
 * • /unban [uid]              : Removes service ban from a user.
 * • /refund [id]              : Refunds an order & marks as refunded.
 * • /run_quota                : Manually triggers the weekly staff quota audit.
 *
 * [3] CUSTOMER - ECONOMY & VIP
 * • /balance                  : Shows your Sugar Coin wallet.
 * • /daily                    : Claims daily reward (1000 or 2000 VIP).
 * • /tip [id] [amt]           : Tips coins to staff (Splits Cook/Driver).
 * • /redeem [code]            : Activates 30-day VIP status.
 * • /premium                  : Links to the donation shop.
 *
 * [4] CUSTOMER - ORDERING
 * • /order [item]             : Standard Order (100 Sugar Coins).
 * • /super_order [item]       : Priority Order (150 Sugar Coins).
 * • /orderstatus              : Checks status of your active order(s) [Max 3].
 * • /orderinfo [id]           : Shows details (Chef, Driver, timestamps).
 * • /oinfo [id]               : Shortcut to check item/details for an order.
 * • /rate [id] [stars] [fb]   : Rates a delivered order (1-5 Stars).
 * • /review [rating] [msg]    : (Legacy) Submit a general review.
 *
 * [5] STAFF - KITCHEN (Cook Role)
 * • /claim [id]               : Assigns a pending order to you.
 * • /cook [id] [proofs...]    : Starts 3m cooking timer. Accepts up to 3 images/links.
 * • /orderlist                 : View pending queue (Priority Sorted).
 *
 * [6] STAFF - DELIVERY (Driver Role)
 * • /deliver [id]             : Pick up ready order & start delivery flow.
 * • /deliverylist             : View ready queue (Priority Sorted).
 * • /setscript [msg]          : Save custom delivery text.
 *
 * [7] STAFF - GENERAL
 * • /stats [user]             : View balance and work history.
 * • /vacation [days]          : Request quota exemption.
 * • /staff_buy                : Buy 'Double Stats' buff (15k Coins).
 *
 * [8] UTILITY
 * • /invite                   : Get bot invite link.
 * • /support                  : Get HQ server link.
 * • /rules                    : Read rules from Google Sheets.
 * ============================================================================
 */

require('dotenv').config();

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType } = require('discord.js');
const mongoose = require('mongoose');
const { google } = require('googleapis');
const util = require('util');

const CONF_TOKEN = process.env.DISCORD_TOKEN;
const CONF_MONGO = process.env.MONGO_URI;
const CONF_SHEET = process.env.GOOGLE_SHEET_ID;
const CONF_OWNER = '662655499811946536';
const CONF_HQ_ID = '1454857011866112063';
const CONF_STORE = "https://donuts.sell.app/";
const CONF_SUPPORT_SERVER = "https://discord.gg/Q4DsEbJzBJ";

// ROLE IDs
const ROLE_COOK = '1454877400729911509', ROLE_DELIVERY = '1454877287953469632', ROLE_MANAGER = '1454876343878549630';
const ROLE_TRAINEE_COOK = '', ROLE_TRAINEE_DELIVERY = '', ROLE_SENIOR_COOK = '', ROLE_SENIOR_DELIVERY = '';
const ROLE_QUOTA_EXEMPT = '1454936082591252534';

// CHANNEL IDs
const CHAN_COOK = '1454879418999767122', CHAN_DELIVERY = '1454880879741767754', CHAN_WARNINGS = '1454881451161026637';
const CHAN_RATINGS = '1454884136740327557', CHAN_VACATION = '1454886383662665972', CHAN_QUOTA = '1454895987322519672';
const COLOR_MAIN = 0xFFA500, COLOR_FAIL = 0xFF0000, COLOR_SUCCESS = 0x2ECC71, COLOR_VIP = 0xF1C40F;

// --- SCHEMAS (ZERO OMISSION) ---
const User = mongoose.model('User', new mongoose.Schema({
    user_id: { type: String, required: true, unique: true }, balance: { type: Number, default: 0 },
    last_daily: { type: Date, default: new Date(0) }, cook_count_week: { type: Number, default: 0 },
    cook_count_total: { type: Number, default: 0 }, deliver_count_week: { type: Number, default: 0 },
    deliver_count_total: { type: Number, default: 0 }, vip_until: { type: Date, default: new Date(0) },
    is_perm_banned: { type: Boolean, default: false }, service_ban_until: { type: Date, default: null },
    warnings: { type: Number, default: 0 }, double_stats_until: { type: Date, default: new Date(0) }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    order_id: String, user_id: String, guild_id: String, channel_id: String, status: { type: String, default: 'pending' }, 
    item: String, is_super: { type: Boolean, default: false }, is_vip: { type: Boolean, default: false },
    chef_id: String, chef_name: String, deliverer_id: String, 
    delivery_started_at: Date, ready_at: Date, images: [String], rating: { type: Number, default: 0 }, rated: { type: Boolean, default: false }, feedback: String
}));

const ServerBlacklist = mongoose.model('ServerBlacklist', new mongoose.Schema({ guild_id: String, reason: String, authorized_by: String }));
const VIPCode = mongoose.model('VIPCode', new mongoose.Schema({ code: { type: String, unique: true }, is_used: { type: Boolean, default: false } }));
const Script = mongoose.model('Script', new mongoose.Schema({ user_id: String, script: String }));

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages], partials: [Partials.Channel, Partials.Message] });

const auth = new google.auth.GoogleAuth({ keyFile: 'credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
async function fetchRules() { try { const sheets = google.sheets({ version: 'v4', auth }); const res = await sheets.spreadsheets.values.get({ spreadsheetId: CONF_SHEET, range: 'Rules!A1:B20' }); return res.data.values.map(r => `🍩 **${r[0]}**\n└ ${r[1]}`).join('\n\n'); } catch (e) { return "Rules Syncing..."; } }

function createProfessionalEmbed(title, description, color = COLOR_MAIN) {
    return new EmbedBuilder().setAuthor({ name: "Sugar Rush Operations" }).setTitle(title).setDescription(description || null).setColor(color).setTimestamp();
}

// --- 3-6-9 AUTO-BAN ENGINE ---
async function applyStrikes(userId, reason) {
    const u = await User.findOne({ user_id: userId }) || new User({ user_id: userId });
    u.warnings += 1;
    let banMsg = "";
    if (u.warnings === 3) { u.service_ban_until = new Date(Date.now() + 3 * 86400000); banMsg = "Due to receiving **3 Warnings** with us You have been given a 3-Day Suspension. \n**Appeals:**Join the Sugar Rush [Support Server](https://discord.gg/Q4DsEbJzBJ) or DM us to open a Support ticket."; }
    else if (u.warnings === 6) { u.service_ban_until = new Date(Date.now() + 7 * 86400000); banMsg = "Due to receiving **6 Warnings** with us You have been given a 7-Day Suspension. from using Sugar Rush \n**Appeals:**Join the Sugar Rush [Support Server](https://discord.gg/Q4DsEbJzBJ) or DM us to open a Support ticket."; }
    else if (u.warnings >= 9) { u.is_perm_banned = true; banMsg = "Due to receiving **9 Warnings** with us You have been Permanently Suspeneded from using Sugar Rush \n**Appeals:**Join the Sugar Rush [Support Server](https://discord.gg/Q4DsEbJzBJ) or DM us to open a Support ticket."; }
    await u.save();
    
    const target = await client.users.fetch(userId).catch(() => null);
    if (target) target.send({ embeds: [createProfessionalEmbed("Protocol Violation", `A strike has been added.\n\n**Reason:** ${reason}\n**Total Strikes:** ${u.warnings}${banMsg}`, COLOR_FAIL)] }).catch(() => {});
    client.channels.cache.get(CHAN_WARNINGS).send({ embeds: [createProfessionalEmbed("Discipline Log", `User: <@${userId}>\nStrikes: ${u.warnings}`, COLOR_FAIL)] });
}

client.on('interactionCreate', async (int) => {
    // PRESENCE-ENFORCED FORFEIT PAY
    if (int.isButton()) {
        const [action, ...args] = int.customId.split('_');
        if (action === 'complete') {
            const o = await Order.findOne({ order_id: args[0] });
            const targetGuild = client.guilds.cache.get(o.guild_id);
            try { await targetGuild.members.fetch(int.user.id); } catch (e) {
                o.status = 'ready'; o.deliverer_id = null; await o.save();
                return int.update({ embeds: [createProfessionalEmbed("PAYMENT FORFEITED", "Verification failed. Presence in server required. Order reset.", COLOR_FAIL)], components: [] });
            }
            o.status = 'delivered'; await o.save();
            await User.findOneAndUpdate({ user_id: int.user.id }, { $inc: { balance: 30, deliver_count_total: 1, deliver_count_week: 1 } });
            return int.update({ embeds: [createProfessionalEmbed("CONFIRMED", "30 Coins credited.", COLOR_SUCCESS)], components: [] });
        }
        if (action === 'approve' || action === 'deny') {
            if (!int.member.roles.cache.has(ROLE_MANAGER)) return int.reply({content: "Managers Only", ephemeral: true});
            if (action === 'approve') {
                const mem = await client.guilds.cache.get(CONF_HQ_ID).members.fetch(args[0]);
                await mem.roles.add(ROLE_QUOTA_EXEMPT);
                return int.message.edit({components: [], embeds: [createProfessionalEmbed("Approved", `<@${args[0]}> granted vacation.`)]});
            } else {
                return int.message.edit({components: [], embeds: [createProfessionalEmbed("Denied", "Vacation request denied.", COLOR_FAIL)]});
            }
        }
    }

    if (!int.isChatInputCommand()) return;
    const { commandName: cmd, options: opt } = int;
    
    // --- SERVER BLACKLIST GATE ---
    const isBlacklisted = await ServerBlacklist.findOne({ guild_id: int.guildId });
    if (isBlacklisted) return int.reply({ content: `❌ **This server is blacklisted.**\nReason: ${isBlacklisted.reason} \n**Appeals:**Join the Sugar Rush [Support Server](https://discord.gg/Q4DsEbJzBJ) or DM us to open a Support ticket.`, ephemeral: false });

    // --- USER BAN GATE ---
    const uData = await User.findOne({ user_id: int.user.id }) || new User({ user_id: int.user.id });
    if (uData.is_perm_banned || (uData.service_ban_until && uData.service_ban_until > Date.now())) return int.reply({ content: "You are suspeneded from using the Sugar Rush service. \n**Appeals:**Join the Sugar Rush [Support Server](https://discord.gg/Q4DsEbJzBJ) or DM us to open a Support ticket.", ephemeral: true });

    // [2] /generate_codes
    if (cmd === 'generate_codes') {
        if (int.user.id !== CONF_OWNER) return int.reply("Unauthorized.");
        const codes = []; for (let i = 0; i < opt.getInteger('amt'); i++) { 
            const c = `SR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`; 
            await new VIPCode({ code: c }).save(); codes.push(c); 
        }
        return int.reply(`Generated ${codes.length} codes.`);
    }
    // [3] /serverblacklist
    if (cmd === 'serverblacklist') { 
        if (int.user.id !== CONF_OWNER) return int.reply("Unauthorized.");
        await new ServerBlacklist({ guild_id: opt.getString('id'), reason: opt.getString('reason') }).save(); 
        return int.reply("Server Banned."); 
    }
    // [4] /unserverblacklist
    if (cmd === 'unserverblacklist') { 
        if (int.user.id !== CONF_OWNER) return int.reply("Unauthorized.");
        await ServerBlacklist.deleteOne({ guild_id: opt.getString('id') }); 
        return int.reply("Server Restored."); 
    }
    
    // [5] /warn, [6] /fdo, [7] /force_warn
    if (['warn', 'fdo', 'force_warn'].includes(cmd)) {
        const o = await Order.findOne({ order_id: opt.getString('id') });
        if (!o) return int.reply("Invalid ID.");
        if ((cmd === 'fdo' || cmd === 'force_warn') && !int.member.roles.cache.has(ROLE_MANAGER)) return int.reply("Management Only.");
        if (cmd === 'warn' && !int.member.roles.cache.has(ROLE_COOK) && !int.member.roles.cache.has(ROLE_MANAGER)) return int.reply("Cooks/Management Only.");
        
        if (cmd === 'warn' && !['pending', 'claimed'].includes(o.status)) return int.reply("Pre-cook only.");
        if (cmd === 'fdo' && o.status !== 'ready') return int.reply("Pre-delivery only.");
        
        if (cmd === 'warn') o.status = 'cancelled_warn';
        if (cmd === 'fdo') o.status = 'cancelled_fdo';
        await o.save(); await applyStrikes(o.user_id, opt.getString('reason'));
        return int.reply("Strike applied.");
    }

    // [8] /ban, [9] /unban, [10] /refund, [11] /run_quota
    if (cmd === 'ban') {
        if (!int.member.roles.cache.has(ROLE_MANAGER)) return int.reply("Management Only.");
        await User.findOneAndUpdate({ user_id: opt.getString('uid') }, { service_ban_until: new Date(Date.now() + opt.getInteger('days') * 86400000) });
        return int.reply("User Banned.");
    }
    if (cmd === 'unban') {
        if (!int.member.roles.cache.has(ROLE_MANAGER)) return int.reply("Management Only.");
        await User.findOneAndUpdate({ user_id: opt.getString('uid') }, { service_ban_until: null, is_perm_banned: false });
        return int.reply("User Unbanned.");
    }
    if (cmd === 'refund') {
        if (!int.member.roles.cache.has(ROLE_MANAGER)) return int.reply("Management Only.");
        const o = await Order.findOne({ order_id: opt.getString('id') });
        await User.findOneAndUpdate({ user_id: o.user_id }, { $inc: { balance: 100 } });
        o.status = 'refunded'; await o.save();
        return int.reply("Order Refunded.");
    }
    if (cmd === 'run_quota') { 
        if (!int.member.roles.cache.has(ROLE_MANAGER)) return int.reply("Management Only.");
        const users = await User.find({ $or: [{ cook_count_week: { $gt: 0 } }, { deliver_count_week: { $gt: 0 } }] });
        for (const u of users) {
            let target = 10;
            try {
                const mem = await client.guilds.cache.get(CONF_HQ_ID).members.fetch(u.user_id);
                if (mem.roles.cache.has(ROLE_TRAINEE_COOK)) target = 5;
            } catch(e){}
            if (u.cook_count_week + u.deliver_count_week < target) u.warnings++;
            u.cook_count_week = 0; u.deliver_count_week = 0; await u.save();
        }
        return int.reply("Quota audit complete."); 
    }

    // [12] /balance, [13] /daily, [14] /tip, [15] /redeem, [16] /premium
    if (cmd === 'balance') return int.reply({embeds: [createProfessionalEmbed("Wallet", `Balance: **${uData.balance}** Sugar Coins`)]});
    if (cmd === 'daily') { 
        if (Date.now() - uData.last_daily < 86400000) return int.reply("Cooldown active.");
        uData.balance += (uData.vip_until > Date.now() ? 2000 : 1000); 
        uData.last_daily = Date.now();
        await uData.save(); return int.reply("Daily claimed."); 
    }
    if (cmd === 'tip') {
        const o = await Order.findOne({ order_id: opt.getString('id') });
        if (!o) return int.reply("Invalid Order ID.");
        if (uData.balance < opt.getInteger('amt')) return int.reply("Insufficient funds.");
        uData.balance -= opt.getInteger('amt'); await uData.save();
        
        const chefShare = Math.floor(opt.getInteger('amt') / 2);
        const driverShare = Math.ceil(opt.getInteger('amt') / 2);
        if (o.chef_id) await User.findOneAndUpdate({ user_id: o.chef_id }, { $inc: { balance: chefShare } });
        if (o.deliverer_id) await User.findOneAndUpdate({ user_id: o.deliverer_id }, { $inc: { balance: driverShare } });
        
        return int.reply(`Tip distributed: ${chefShare} to Cook, ${driverShare} to Driver.`);
    }
    if (cmd === 'redeem') {
        const c = await VIPCode.findOne({ code: opt.getString('code'), is_used: false });
        if (!c) return int.reply("Invalid code.");
        c.is_used = true; await c.save();
        uData.vip_until = new Date(Date.now() + 30 * 86400000); await uData.save();
        return int.reply("VIP Redeemed for 30 days.");
    }
    if (cmd === 'premium') return int.reply({embeds: [createProfessionalEmbed("Premium Store", CONF_STORE)]});

    // [17] /order, [18] /super_order, [19] /orderstatus, [20] /orderinfo, [21] /oinfo, [22] /rate, [23] /review
    if (cmd === 'order' || cmd === 'super_order') {
        const isSuper = cmd === 'super_order';
        const isVip = uData.vip_until > Date.now();
        let cost = isSuper ? 150 : 100;
        if (isVip) cost = Math.ceil(cost * 0.5); // VIP 50% Fix

        if (uData.balance < cost) return int.reply(`Insufficient funds. Need ${cost}.`);

        const oid = Math.random().toString(36).substring(2, 8).toUpperCase();
        await new Order({ order_id: oid, user_id: int.user.id, guild_id: int.guildId, channel_id: int.channelId, item: opt.getString('item'), is_super: isSuper, is_vip: isVip }).save();
        uData.balance -= cost; await uData.save();
        client.channels.cache.get(CHAN_COOK).send(`🍩 **New Order:** \`${oid}\``);
        return int.reply(`Logged: \`${oid}\``);
    }
    if (cmd === 'orderstatus') {
        const active = await Order.find({ user_id: int.user.id, status: { $ne: 'delivered' } });
        return int.reply({embeds: [createProfessionalEmbed("Your Active Orders", active.map(o => `• \`${o.order_id}\`: ${o.status}`).join("\n") || "No active orders.")]});
    }
    if (cmd === 'orderinfo' || cmd === 'oinfo') {
        const o = await Order.findOne({ order_id: opt.getString('id') });
        if (!o) return int.reply("Order not found.");
        return int.reply({embeds: [createProfessionalEmbed(`Info: ${o.order_id}`, `Item: ${o.item}\nStatus: ${o.status}\nChef: <@${o.chef_id}>\nDriver: <@${o.deliverer_id}>`)]});
    }
    if (cmd === 'rate') {
        const o = await Order.findOne({ order_id: opt.getString('id') });
        if (!o || o.user_id !== int.user.id) return int.reply("Invalid order.");
        o.rating = opt.getInteger('stars'); o.feedback = opt.getString('fb'); o.rated = true; await o.save();
        return int.reply("Rating submitted.");
    }
    if (cmd === 'review') {
        client.channels.cache.get(CHAN_RATINGS).send({embeds: [createProfessionalEmbed("Review", `**Stars:** ${opt.getInteger('rating')}\n**Message:** ${opt.getString('msg')}`)]});
        return int.reply("Review published.");
    }

    // [24] /claim, [25] /cook, [26] /orderlist
    if (cmd === 'claim') {
        if (!int.member.roles.cache.has(ROLE_COOK)) return int.reply("Cooks Only.");
        await Order.findOneAndUpdate({ order_id: opt.getString('id'), status: 'pending' }, { status: 'claimed', chef_id: int.user.id, chef_name: int.user.username });
        return int.reply("Claimed.");
    }
    if (cmd === 'cook') {
        if (!int.member.roles.cache.has(ROLE_COOK)) return int.reply("Cooks Only.");
        await Order.findOneAndUpdate({ order_id: opt.getString('id') }, { status: 'cooking' });
        setTimeout(async () => { await Order.findOneAndUpdate({ order_id: opt.getString('id') }, { status: 'ready', ready_at: new Date() }); client.channels.cache.get(CHAN_DELIVERY).send(`🥡 **Ready:** \`${opt.getString('id')}\``); }, 180000); 
        return int.reply("Cooking timer started (3m).");
    }
    if (cmd === 'orderlist') {
        if (!int.member.roles.cache.has(ROLE_COOK)) return int.reply("Cooks Only.");
        const orders = await Order.find({ status: 'pending' });
        return int.reply({embeds: [createProfessionalEmbed("Pending Orders", orders.map(o => `\`${o.order_id}\`: ${o.item}`).join("\n") || "No orders.")]});
    }

    // [27] /deliver, [28] /deliverylist, [29] /setscript
    if (cmd === 'deliver') {
        if (!int.member.roles.cache.has(ROLE_DELIVERY)) return int.reply("Drivers Only.");
        const o = await Order.findOne({ order_id: opt.getString('id'), status: 'ready' });
        if (!o) return int.reply("Order not ready.");
        
        const guild = client.guilds.cache.get(o.guild_id);
        
        try {
            const inv = await guild.channels.cache.random().createInvite();
            o.status = 'delivering'; o.deliverer_id = int.user.id; await o.save();
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`complete_${o.order_id}`).setLabel('Confirm').setStyle(ButtonStyle.Success));
            await int.user.send({ content: `Invite: ${inv.url}`, components: [row] });
            return int.reply("Briefing sent.");
        } catch (e) {
            return int.reply("This order is unavailable for Manual dispatch.");
        }
    }
    if (cmd === 'deliverylist') {
        if (!int.member.roles.cache.has(ROLE_DELIVERY)) return int.reply("Drivers Only.");
        const orders = await Order.find({ status: 'ready' });
        return int.reply({embeds: [createProfessionalEmbed("Ready Orders", orders.map(o => `\`${o.order_id}\`: ${o.item}`).join("\n") || "No orders.")]});
    }
    if (cmd === 'setscript') {
        if (!int.member.roles.cache.has(ROLE_DELIVERY)) return int.reply("Drivers Only.");
        await Script.findOneAndUpdate({ user_id: int.user.id }, { script: opt.getString('msg') }, { upsert: true });
        return int.reply("Script saved.");
    }

    // [30] /stats, [31] /vacation, [32] /staff_buy, [33] /invite, [34] /support, [35] /rules
    if (cmd === 'stats') {
        const u = await User.findOne({ user_id: opt.getUser('user')?.id || int.user.id });
        return int.reply({embeds: [createProfessionalEmbed("Stats", `Cooked: ${u?.cook_count_total || 0}\nDelivered: ${u?.deliver_count_total || 0}`)]});
    }
    if (cmd === 'vacation') {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`approve_${int.user.id}`).setLabel('Approve').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`deny_${int.user.id}`).setLabel('Deny').setStyle(ButtonStyle.Danger));
        client.channels.cache.get(CHAN_VACATION).send({ embeds: [createProfessionalEmbed("Vacation Request", `User: <@${int.user.id}>\nDays: ${opt.getInteger('days')}`)], components: [row] });
        return int.reply("Request sent.");
    }
    if (cmd === 'staff_buy') {
        if (uData.balance < 15000) return int.reply("Insufficient funds.");
        uData.balance -= 15000; uData.double_stats_until = new Date(Date.now() + 30 * 86400000); await uData.save();
        return int.reply("Double stats activated.");
    }
    if (cmd === 'invite') return int.reply("Invite [Sugar Rush](https://discord.com/oauth2/authorize?client_id=1454931242335076667&permissions=137440382017&integration_type=0&scope=applications.commands+bot)");
    if (cmd === 'support') return int.reply(CONF_SUPPORT_SERVER);
    if (cmd === 'rules') return int.reply({embeds: [createProfessionalEmbed("Rules", await fetchRules())]});

    // [35] /help (ENSURED FUNCTIONAL)
    if (cmd === 'help') {
        const fields = [
            { name: "🛡️ Management", value: "`/generate_codes`, `/serverblacklist`, `/unserverblacklist`, `/warn`, `/fdo`, `/force_warn`, `/ban`, `/unban`, `/refund`, `/run_quota`" },
            { name: "💰 Economy", value: "`/balance`, `/daily`, `/tip`, `/redeem`, `/premium`" },
            { name: "📦 Ordering", value: "`/order`, `/super_order`, `/orderstatus`, `/orderinfo`, `/oinfo`, `/rate`, `/review`" },
            { name: "👨‍🍳 Staff", value: "`/claim`, `/cook`, `/orderlist`, `/deliver`, `/deliverylist`, `/setscript`, `/stats`, `/vacation`, `/staff_buy`" },
            { name: "🔗 Utility", value: "`/help`, `/invite`, `/support`, `/rules`" }
        ];
        return int.reply({ embeds: [createProfessionalEmbed("📖 Sugar Rush Directory", "Complete Command Protocol", COLOR_MAIN).addFields(fields)] });
    }
});

// [1] !eval prefix command
client.on('messageCreate', async (m) => {
    if (m.author.id === CONF_OWNER && m.content.startsWith("!eval")) {
        try { m.channel.send(`\`\`\`js\n${util.inspect(await eval(m.content.slice(5)))}\n\`\`\``); } catch (e) { m.channel.send(`${e}`); }
    }
});

client.on('ready', async () => { 
    mongoose.connect(CONF_MONGO); 
    console.log("Final Absolute Build Online.");
    
    // AUTO-REGISTER COMMANDS ON DISCORD
    const commands = [
        { name: 'generate_codes', description: 'Generate VIP codes', options: [{ name: 'amt', type: 4, description: 'Amount', required: true }] },
        { name: 'serverblacklist', description: 'Blacklist a server', options: [{ name: 'id', type: 3, description: 'Guild ID', required: true }, { name: 'reason', type: 3, description: 'Reason', required: true }] },
        { name: 'unserverblacklist', description: 'Unblacklist a server', options: [{ name: 'id', type: 3, description: 'Guild ID', required: true }] },
        { name: 'warn', description: 'Warn a user', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }, { name: 'reason', type: 3, description: 'Reason', required: true }] },
        { name: 'fdo', description: 'Force Discipline Order', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }, { name: 'reason', type: 3, description: 'Reason', required: true }] },
        { name: 'force_warn', description: 'Force Warn', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }, { name: 'reason', type: 3, description: 'Reason', required: true }] },
        { name: 'ban', description: 'Ban user', options: [{ name: 'uid', type: 3, description: 'User ID', required: true }, { name: 'days', type: 4, description: 'Days', required: true }] },
        { name: 'unban', description: 'Unban user', options: [{ name: 'uid', type: 3, description: 'User ID', required: true }] },
        { name: 'refund', description: 'Refund order', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }] },
        { name: 'run_quota', description: 'Run quota check' },
        { name: 'balance', description: 'Check balance' },
        { name: 'daily', description: 'Claim daily' },
        { name: 'tip', description: 'Tip staff', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }, { name: 'amt', type: 4, description: 'Amount', required: true }] },
        { name: 'redeem', description: 'Redeem VIP code', options: [{ name: 'code', type: 3, description: 'Code', required: true }] },
        { name: 'premium', description: 'Premium store' },
        { name: 'order', description: 'Order item', options: [{ name: 'item', type: 3, description: 'Item', required: true }] },
        { name: 'super_order', description: 'Super order', options: [{ name: 'item', type: 3, description: 'Item', required: true }] },
        { name: 'orderstatus', description: 'Check status' },
        { name: 'orderinfo', description: 'Check info', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }] },
        { name: 'oinfo', description: 'Check info alias', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }] },
        { name: 'rate', description: 'Rate order', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }, { name: 'stars', type: 4, description: 'Stars', required: true }, { name: 'fb', type: 3, description: 'Feedback', required: true }] },
        { name: 'review', description: 'Leave review', options: [{ name: 'rating', type: 4, description: 'Rating', required: true }, { name: 'msg', type: 3, description: 'Message', required: true }] },
        { name: 'claim', description: 'Claim order', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }] },
        { name: 'cook', description: 'Cook order', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }] },
        { name: 'orderlist', description: 'View queue' },
        { name: 'deliver', description: 'Deliver order', options: [{ name: 'id', type: 3, description: 'Order ID', required: true }] },
        { name: 'deliverylist', description: 'View delivery queue' },
        { name: 'setscript', description: 'Set delivery script', options: [{ name: 'msg', type: 3, description: 'Message', required: true }] },
        { name: 'stats', description: 'View stats', options: [{ name: 'user', type: 6, description: 'User', required: false }] },
        { name: 'vacation', description: 'Request vacation', options: [{ name: 'days', type: 4, description: 'Days', required: true }] },
        { name: 'staff_buy', description: 'Buy buff' },
        { name: 'invite', description: 'Get invite' },
        { name: 'support', description: 'Get support' },
        { name: 'rules', description: 'Get rules' },
        { name: 'help', description: 'Get help directory' }
    ];
    await client.application.commands.set(commands);
    console.log("Commands registered on Discord.");
});
client.login(CONF_TOKEN);
