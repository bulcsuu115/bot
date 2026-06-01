import { Context, InlineKeyboard } from 'grammy';
import { User } from '../database/models/User';
import { Wallet } from '../database/models/Wallet';
import { Transaction } from '../database/models/Transaction';
import { SniperConfig } from '../database/models/SniperConfig';
import { CopyTrade } from '../database/models/CopyTrade';
import { walletManager } from '../wallet/manager';
import { solanaService } from '../services/solana';
import { swapEngine } from '../trading/swap';
import { sniperEngine } from '../trading/sniper';
import { limitOrderEngine } from '../trading/limit';
import { copyTradeEngine } from '../trading/copy';
import {
  mainKeyboard,
  walletKeyboard,
  walletsListKeyboard,
  buySellKeyboard,
  sniperKeyboard,
  limitOrdersKeyboard,
  copyTradeKeyboard,
  settingsKeyboard,
  confirmKeyboard,
} from './keyboards';
import { logger } from '../utils/logger';

const pendingInputs = new Map<number, { action: string; data: any }>();

export function registerCommands(bot: any): void {
  bot.command('start', startHandler);
  bot.command('wallet', walletHandler);
  bot.command('balance', balanceHandler);
  bot.command('help', helpHandler);

  bot.hears('💰 Wallet', walletHandler);
  bot.hears('🔄 Swap', swapMenuHandler);
  bot.hears('📊 Portfolio', portfolioHandler);
  bot.hears('🎯 Sniper', sniperMenuHandler);
  bot.hears('📋 Limit Orders', limitMenuHandler);
  bot.hears('👥 Copy Trade', copyMenuHandler);
  bot.hears('🤖 AI Trader', aiTraderMenuHandler);
  bot.hears('⚙️ Settings', settingsMenuHandler);
  bot.hears('❓ Help', helpHandler);

  bot.on('callback_query:data', callbackHandler);
  bot.on('message:text', messageHandler);
}

async function startHandler(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await walletManager.ensureUser(telegramId, ctx.from?.username);
  const wallets = await walletManager.getWallets(telegramId);

  let msg = '🚀 *Solana Trojan Bot*\n\nWelcome to the ultimate Solana meme coin trading bot!\n\n';
  msg += '💰 *Wallet* - Create/import wallets\n';
  msg += '🔄 *Swap* - Buy/sell via Jupiter\n';
  msg += '🎯 *Sniper* - Auto-buy on launch\n';
  msg += '📋 *Limit Orders* - Buy/sell at target price\n';
  msg += '👥 *Copy Trade* - Copy top traders\n';
  msg += '🤖 *AI Trader* - Automated AI trading\n';
  msg += '📊 *Portfolio* - Track balances\n\n';

  if (wallets.length === 0) {
    msg += 'No wallets yet. Click 💰 Wallet to create or import one.';
  } else {
    msg += `You have ${wallets.length} wallet(s). Select a feature below.`;
  }

  await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: mainKeyboard() });
}

async function walletHandler(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  const wallets = await walletManager.getWallets(telegramId);

  if (wallets.length === 0) {
    await ctx.reply(
      '💼 *Wallet Management*\n\nNo wallets yet. Create or import one:',
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard()
          .text('➕ Create New Wallet', 'create_wallet')
          .text('📥 Import Wallet', 'import_wallet'),
      }
    );
  } else {
    let msg = '💼 *Your Wallets*\n\n';
    for (let i = 0; i < wallets.length; i++) {
      const w = wallets[i];
      const solBalance = await solanaService.getSolBalance(w.publicKey).catch(() => 0);
      msg += `${i + 1}. *${w.label}* - ◎ ${solBalance.toFixed(3)}\n`;
      msg += `   \`${w.publicKey.slice(0, 8)}...${w.publicKey.slice(-8)}\`\n`;
    }
    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      reply_markup: walletsListKeyboard(wallets),
    });
  }
}

async function balanceHandler(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  const wallets = await walletManager.getWallets(telegramId);

  if (wallets.length === 0) {
    await ctx.reply('No wallets. Create one first under 💰 Wallet.');
    return;
  }

  let msg = '📊 *Portfolio*\n\n';
  for (const w of wallets) {
    try {
      const solBalance = await solanaService.getSolBalance(w.publicKey);
      msg += `*${w.label}*: \`${w.publicKey.slice(0, 8)}...\`\n`;
      msg += `   ◎ ${solBalance.toFixed(4)} SOL\n`;

      const txns = await Transaction.aggregate([
        { $match: { walletId: w.id, status: 'confirmed' } },
        { $group: { _id: '$mint', net: { $sum: { $cond: [{ $eq: ['$type', 'buy'] }, { $toDouble: '$amount' }, { $multiply: [{ $toDouble: '$amount' }, -1] }] } } } },
        { $match: { net: { $gt: 0 } } },
      ]);

      for (const t of txns) {
        const price = await solanaService.getTokenPrice(t._id);
        if (price) {
          msg += `   • \`${t._id.slice(0, 6)}...\` ~ $${(t.net * price).toFixed(2)}\n`;
        }
      }
    } catch {
      msg += `*${w.label}*: Error\n`;
    }
    msg += '\n';
  }

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

async function swapMenuHandler(ctx: Context) {
  await ctx.reply(
    '🔄 *Swap*\n\nPaste any token mint address to buy/sell, or choose below:',
    { parse_mode: 'Markdown', reply_markup: buySellKeyboard('') }
  );
}

async function portfolioHandler(ctx: Context) {
  await balanceHandler(ctx);
}

async function sniperMenuHandler(ctx: Context) {
  await ctx.reply('🎯 *Sniper*\n\nAuto-buy tokens on launch. Configure below.', {
    parse_mode: 'Markdown',
    reply_markup: sniperKeyboard(),
  });
}

async function limitMenuHandler(ctx: Context) {
  await ctx.reply('📋 *Limit Orders*\n\nBuy/sell when price hits your target.', {
    parse_mode: 'Markdown',
    reply_markup: limitOrdersKeyboard(),
  });
}

async function copyMenuHandler(ctx: Context) {
  await ctx.reply('👥 *Copy Trade*\n\nAutomatically copy trades from any wallet.', {
    parse_mode: 'Markdown',
    reply_markup: copyTradeKeyboard(),
  });
}

async function aiTraderMenuHandler(ctx: Context) {
  await ctx.reply(
    '🤖 *AI Trader*\n\n' +
    'Automated AI-powered trading is coming soon!\n\n' +
    'Features planned:\n' +
    '• AI market analysis & predictions\n' +
    '• Automated buy/sell based on AI signals\n' +
    '• Risk management algorithms\n' +
    '• Portfolio optimization\n\n' +
    'Stay tuned for updates!',
    { parse_mode: 'Markdown', reply_markup: mainKeyboard() }
  );
}

async function settingsMenuHandler(ctx: Context) {
  const telegramId = ctx.from!.id;
  const user = await User.findOne({ telegramId });
  const current = user?.defaultSlippage ?? 500;

  await ctx.reply(`⚙️ *Settings*\n\nDefault slippage: ${current} bps (${(current / 100).toFixed(1)}%)`, {
    parse_mode: 'Markdown',
    reply_markup: settingsKeyboard(),
  });
}

async function helpHandler(ctx: Context) {
  await ctx.reply(
    '❓ *Help - Solana Trojan Bot*\n\n' +
    '*/start* - Main menu\n' +
    '*/wallet* - Wallet mgmt\n' +
    '*/balance* - Portfolio\n' +
    '*/help* - This message\n\n' +
    '*Features:*\n' +
    '💼 *Wallet* - Create or import wallets\n' +
    '🔄 *Swap* - Buy/sell any SPL token\n' +
    '📊 *Portfolio* - Balances & values\n' +
    '🎯 *Sniper* - Auto-buy new tokens\n' +
    '📋 *Limit Orders* - Price target trades\n' +
    '👥 *Copy Trade* - Copy wallets\n' +
    '🤖 *AI Trader* - Automated AI strategies\n\n' +
    '💡 Paste any token mint address for quick buy/sell!\n' +
    '🔒 Private keys encrypted at rest',
    { parse_mode: 'Markdown', reply_markup: mainKeyboard() }
  );
}

async function callbackHandler(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  const data = ctx.callbackQuery!.data!;
  await ctx.answerCallbackQuery();

  if (data === 'back_main') {
    await ctx.deleteMessage();
    await ctx.reply('Main menu:', { reply_markup: mainKeyboard() });
    return;
  }
  if (data === 'close') { await ctx.deleteMessage(); return; }
  if (data === 'back_wallets') { await walletHandler(ctx); return; }
  if (data === 'cancel') {
    pendingInputs.delete(telegramId);
    await ctx.editMessageText('❌ Cancelled.', { reply_markup: { inline_keyboard: [] } });
    return;
  }

  if (data === 'create_wallet') {
    const wallet = await walletManager.createWallet(telegramId);
    await ctx.editMessageText(
      `✅ *Wallet Created!*\n\nLabel: \`${wallet.label}\`\nAddress: \`${wallet.publicKey}\`\n\nKeep your private key safe!`,
      { parse_mode: 'Markdown', reply_markup: walletKeyboard(wallet.id) }
    );
    return;
  }

  if (data === 'import_wallet') {
    pendingInputs.set(telegramId, { action: 'import_wallet', data: {} });
    await ctx.reply('📥 *Import Wallet*\n\nSend me your private key (base58 or hex):', { parse_mode: 'Markdown' });
    return;
  }

  if (data === 'new_wallet') {
    pendingInputs.set(telegramId, { action: 'new_wallet_label', data: {} });
    await ctx.reply('Enter a label (or type "main"):', { parse_mode: 'Markdown' });
    return;
  }

  if (data.startsWith('wallet_')) {
    const walletId = data.split('_')[1];
    const wallet = await walletManager.getWallet(walletId, telegramId);
    if (!wallet) { await ctx.editMessageText('Wallet not found.'); return; }
    const solBalance = await solanaService.getSolBalance(wallet.publicKey);
    await ctx.editMessageText(
      `💼 *${wallet.label}*\n\n\`${wallet.publicKey}\`\n\n◎ ${solBalance.toFixed(4)} SOL`,
      { parse_mode: 'Markdown', reply_markup: walletKeyboard(walletId) }
    );
    return;
  }

  if (data.startsWith('export_')) {
    const walletId = data.split('_')[1];
    const pk = await walletManager.exportPrivateKey(walletId, telegramId);
    if (!pk) { await ctx.answerCallbackQuery('Error'); return; }
    await ctx.reply(
      '⚠️ *Private Key*\n\nNever share this!\n\n' + `\`${pk}\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (data.startsWith('balance_')) {
    const walletId = data.split('_')[1];
    const wallet = await walletManager.getWallet(walletId, telegramId);
    if (!wallet) return;
    const b = await solanaService.getSolBalance(wallet.publicKey);
    await ctx.answerCallbackQuery(`◎ ${b.toFixed(4)} SOL`);
    return;
  }

  if (data.startsWith('delete_')) {
    const walletId = data.split('_')[1];
    pendingInputs.set(telegramId, { action: 'confirm_delete', data: { walletId } });
    await ctx.editMessageText('Delete this wallet?', { reply_markup: confirmKeyboard(`delete_${walletId}`) });
    return;
  }

  if (data.startsWith('confirm_delete_')) {
    const walletId = data.split('_')[2];
    await walletManager.deleteWallet(walletId, telegramId);
    await ctx.editMessageText('✅ Wallet deleted.', { reply_markup: { inline_keyboard: [] } });
    return;
  }

  if (data === 'swap_buy_sol') {
    pendingInputs.set(telegramId, { action: 'buy_token', data: {} });
    await ctx.reply('🔵 Send the token mint address:', { parse_mode: 'Markdown' });
    return;
  }
  if (data === 'swap_sell') {
    pendingInputs.set(telegramId, { action: 'sell_token', data: {} });
    await ctx.reply('🔴 Send the token mint address to sell:', { parse_mode: 'Markdown' });
    return;
  }

  if (data.startsWith('buy_')) {
    const mint = data.split('_')[1];
    if (!mint) { pendingInputs.set(telegramId, { action: 'buy_token', data: {} }); await ctx.reply('Send token mint:'); return; }
    pendingInputs.set(telegramId, { action: 'buy_token_amount', data: { mint } });
    await ctx.reply('Amount in SOL:');
    return;
  }

  if (data.startsWith('sell_')) {
    const mint = data.split('_')[1];
    if (!mint) { pendingInputs.set(telegramId, { action: 'sell_token', data: {} }); await ctx.reply('Send token mint:'); return; }
    pendingInputs.set(telegramId, { action: 'sell_token_amount', data: { mint } });
    await ctx.reply('Amount (0 = all):');
    return;
  }

  if (data.startsWith('price_')) {
    const mint = data.split('_')[1];
    const price = await solanaService.getTokenPrice(mint);
    await ctx.answerCallbackQuery(price ? `$${price.toFixed(8)}` : 'N/A');
    return;
  }

  if (data === 'sniper_new') {
    pendingInputs.set(telegramId, { action: 'sniper_setup_mint', data: {} });
    await ctx.reply('🎯 Send token mint to snipe:', { parse_mode: 'Markdown' });
    return;
  }
  if (data === 'sniper_list') {
    const snipers = await SniperConfig.find({ telegramId });
    if (snipers.length === 0) { await ctx.reply('No active snipers.', { reply_markup: sniperKeyboard() }); return; }
    let msg = '🎯 *Your Snipers*\n\n';
    snipers.forEach((s, i) => {
      msg += `${i + 1}. \`${(s.mint || '').slice(0, 8)}...\` | ${s.buyAmountSol} SOL | ${s.isActive ? '🟢' : '🔴'}\n`;
    });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: sniperKeyboard() });
    return;
  }

  if (data === 'limit_new') {
    pendingInputs.set(telegramId, { action: 'limit_new_mint', data: {} });
    await ctx.reply('📋 Send token mint:', { parse_mode: 'Markdown' });
    return;
  }
  if (data === 'limit_active') {
    const orders = await limitOrderEngine.getOrders(telegramId, 'active');
    if (orders.length === 0) { await ctx.reply('No active orders.'); return; }
    let msg = '📋 *Active Orders*\n\n';
    orders.forEach((o: any, i: number) => {
      msg += `${i + 1}. ${o.type.toUpperCase()} \`${o.mint.slice(0, 8)}...\` @ $${o.triggerPrice}\n`;
    });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: limitOrdersKeyboard() });
    return;
  }
  if (data === 'limit_history') {
    const orders = await limitOrderEngine.getOrders(telegramId);
    const filled = orders.filter((o: any) => o.status === 'filled');
    if (filled.length === 0) { await ctx.reply('No filled orders.'); return; }
    let msg = '📋 *History*\n\n';
    filled.forEach((o: any, i: number) => {
      msg += `${i + 1}. ✅ ${o.type.toUpperCase()} @ $${o.triggerPrice}\n`;
    });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: limitOrdersKeyboard() });
    return;
  }

  if (data === 'copy_new') {
    pendingInputs.set(telegramId, { action: 'copy_new_target', data: {} });
    await ctx.reply('👥 Send wallet address to copy:', { parse_mode: 'Markdown' });
    return;
  }
  if (data === 'copy_list') {
    const copies = await CopyTrade.find({ telegramId });
    if (copies.length === 0) { await ctx.reply('No active copy trades.'); return; }
    let msg = '👥 *Active Copy Trades*\n\n';
    copies.forEach((c, i) => {
      msg += `${i + 1}. \`${c.targetWallet.slice(0, 8)}...\` | ${c.isActive ? '🟢' : '🔴'}\n`;
    });
    await ctx.editMessageText(msg, { parse_mode: 'Markdown', reply_markup: copyTradeKeyboard() });
    return;
  }

  if (data === 'set_slippage') {
    pendingInputs.set(telegramId, { action: 'set_slippage', data: {} });
    await ctx.reply('Enter slippage in BPS (500 = 5%):');
    return;
  }

  if (data === 'set_rpc') {
    await ctx.reply('RPC can only be changed in .env on the server.');
    return;
  }

  logger.warn({ telegramId, data }, 'Unhandled callback');
}

async function messageHandler(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId || !ctx.message?.text) return;

  const text = ctx.message.text.trim();
  const pending = pendingInputs.get(telegramId);

  if (!pending) {
    if (text.length === 44 && !text.endsWith('=') && !text.startsWith('0')) {
      const wallets = await walletManager.getWallets(telegramId);
      if (wallets.length === 0) {
        await ctx.reply('Create a wallet first under 💰 Wallet.');
        return;
      }
      await ctx.reply(`Token: \`${text}\``, { parse_mode: 'Markdown', reply_markup: buySellKeyboard(text) });
      return;
    }
    await ctx.reply('Use the menu below or type /help', { reply_markup: mainKeyboard() });
    return;
  }

  switch (pending.action) {
    case 'import_wallet': {
      try {
        const wallets = await walletManager.getWallets(telegramId);
        const label = `wallet_${wallets.length + 1}`;
        const wallet = await walletManager.importWallet(telegramId, text, label);
        await ctx.reply(`✅ Imported!\n\n\`${wallet.publicKey}\``, { parse_mode: 'Markdown' });
      } catch (error: any) {
        await ctx.reply(`❌ ${error.message}`);
      }
      pendingInputs.delete(telegramId);
      break;
    }
    case 'new_wallet_label': {
      const wallet = await walletManager.createWallet(telegramId, text);
      await ctx.reply(`✅ *${wallet.label}* created!\n\n\`${wallet.publicKey}\``, { parse_mode: 'Markdown', reply_markup: walletKeyboard(wallet.id) });
      pendingInputs.delete(telegramId);
      break;
    }
    case 'buy_token': {
      pendingInputs.set(telegramId, { action: 'buy_token_amount', data: { mint: text } });
      await ctx.reply('Amount in SOL:');
      break;
    }
    case 'buy_token_amount': {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) { await ctx.reply('Invalid amount.'); return; }
      const { mint } = pending.data;
      const wallets = await walletManager.getWallets(telegramId);
      if (wallets.length === 0) { await ctx.reply('Create a wallet first.'); pendingInputs.delete(telegramId); return; }
      const statusMsg = await ctx.reply(`🔄 Buying ${amount} SOL...`, { parse_mode: 'Markdown' });
      const result = await swapEngine.buyToken(telegramId, wallets[0].id, mint, amount);
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id,
        result.success ? `✅ Done! \`${result.signature}\`` : `❌ ${result.error}`,
        { parse_mode: 'Markdown' });
      pendingInputs.delete(telegramId);
      break;
    }
    case 'sell_token': {
      pendingInputs.set(telegramId, { action: 'sell_token_amount', data: { mint: text } });
      await ctx.reply('Amount (0 = all):');
      break;
    }
    case 'sell_token_amount': {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount < 0) { await ctx.reply('Invalid.'); return; }
      const { mint } = pending.data;
      const wallets = await walletManager.getWallets(telegramId);
      if (wallets.length === 0) { await ctx.reply('Create a wallet first.'); pendingInputs.delete(telegramId); return; }
      const statusMsg = await ctx.reply('🔄 Selling...', { parse_mode: 'Markdown' });
      const result = await swapEngine.sellToken(telegramId, wallets[0].id, mint, amount);
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id,
        result.success ? `✅ Done! \`${result.signature}\`` : `❌ ${result.error}`,
        { parse_mode: 'Markdown' });
      pendingInputs.delete(telegramId);
      break;
    }
    case 'sniper_setup_mint': {
      pendingInputs.set(telegramId, { action: 'sniper_setup_amount', data: { mint: text } });
      await ctx.reply('Amount in SOL (e.g. 0.1):');
      break;
    }
    case 'sniper_setup_amount': {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) { await ctx.reply('Invalid.'); return; }
      const { mint } = pending.data;
      const wallets = await walletManager.getWallets(telegramId);
      if (wallets.length === 0) { await ctx.reply('Create a wallet first.'); pendingInputs.delete(telegramId); return; }
      const config = await SniperConfig.create({ telegramId, walletId: wallets[0].id, mint, buyAmountSol: text });
      sniperEngine.start(config._id.toString(), telegramId, wallets[0].id, mint, text);
      await ctx.reply(`✅ Sniping \`${mint}\` with ${amount} SOL!`, { parse_mode: 'Markdown' });
      pendingInputs.delete(telegramId);
      break;
    }
    case 'limit_new_mint': {
      pendingInputs.set(telegramId, { action: 'limit_new_type', data: { mint: text } });
      await ctx.reply('Buy or sell?');
      break;
    }
    case 'limit_new_type': {
      if (!['buy', 'sell'].includes(text.toLowerCase())) { await ctx.reply('Type "buy" or "sell".'); return; }
      pendingInputs.set(telegramId, { ...pending, data: { ...pending.data, type: text.toLowerCase() }, action: 'limit_new_price' });
      await ctx.reply('Trigger price in USD:');
      break;
    }
    case 'limit_new_price': {
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) { await ctx.reply('Invalid price.'); return; }
      pendingInputs.set(telegramId, { ...pending, data: { ...pending.data, price: text }, action: 'limit_new_amount' });
      await ctx.reply('Amount in SOL:');
      break;
    }
    case 'limit_new_amount': {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) { await ctx.reply('Invalid.'); return; }
      const { mint, type, price } = pending.data;
      const wallets = await walletManager.getWallets(telegramId);
      if (wallets.length === 0) { await ctx.reply('Create a wallet first.'); pendingInputs.delete(telegramId); return; }
      await limitOrderEngine.createOrder(telegramId, wallets[0].id, mint, type, price, text);
      await ctx.reply(`✅ ${type.toUpperCase()} limit @ $${price} for ${text} SOL`);
      pendingInputs.delete(telegramId);
      break;
    }
    case 'copy_new_target': {
      if (text.length < 32) { await ctx.reply('Invalid Solana address.'); return; }
      pendingInputs.set(telegramId, { action: 'copy_new_amount', data: { target: text } });
      await ctx.reply('Max buy in SOL (e.g. 1.0):');
      break;
    }
    case 'copy_new_amount': {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) { await ctx.reply('Invalid.'); return; }
      const { target } = pending.data;
      const wallets = await walletManager.getWallets(telegramId);
      if (wallets.length === 0) { await ctx.reply('Create a wallet first.'); pendingInputs.delete(telegramId); return; }
      const ct = await CopyTrade.create({ telegramId, walletId: wallets[0].id, targetWallet: target, maxBuySol: text });
      copyTradeEngine.start(ct._id.toString(), telegramId, wallets[0].id, target, text);
      await ctx.reply(`✅ Copying \`${target.slice(0, 8)}...\` max ${amount} SOL`);
      pendingInputs.delete(telegramId);
      break;
    }
    case 'set_slippage': {
      const bps = parseInt(text);
      if (isNaN(bps) || bps < 0 || bps > 10000) { await ctx.reply('0-10000 bps.'); return; }
      await User.updateOne({ telegramId }, { defaultSlippage: bps }, { upsert: true });
      await ctx.reply(`✅ Slippage: ${bps} bps (${(bps / 100).toFixed(1)}%)`);
      pendingInputs.delete(telegramId);
      break;
    }
    default:
      await ctx.reply('Use /start');
      pendingInputs.delete(telegramId);
  }
}
