import { InlineKeyboard, Keyboard } from 'grammy';

export function mainKeyboard() {
  return new Keyboard()
    .text('💰 Wallet').text('🔄 Swap').text('📊 Portfolio').row()
    .text('🎯 Sniper').text('📋 Limit Orders').text('👥 Copy Trade').row()
    .text('🤖 AI Trader').text('⚙️ Settings').row()
    .text('❓ Help')
    .resized();
}

export function walletKeyboard(walletId: string) {
  return new InlineKeyboard()
    .text('📤 Export PK', `export_${walletId}`)
    .text('💰 Balance', `balance_${walletId}`)
    .text('🗑 Delete', `delete_${walletId}`)
    .row()
    .text('🔙 Back', 'back_wallets');
}

export function walletsListKeyboard(wallets: { id: string; label: string; publicKey: string }[]) {
  const kb = new InlineKeyboard();
  wallets.forEach((w, i) => {
    kb.text(`${i + 1}. ${w.label}`, `wallet_${w.id}`);
    if ((i + 1) % 2 === 0) kb.row();
  });
  if (wallets.length % 2 !== 0) kb.row();
  kb.text('➕ New Wallet', 'new_wallet').text('📥 Import', 'import_wallet');
  return kb;
}

export function buySellKeyboard(mint: string) {
  return new InlineKeyboard()
    .text('🟢 Buy', `buy_${mint}`)
    .text('🔴 Sell', `sell_${mint}`)
    .row()
    .text('📈 Price', `price_${mint}`)
    .text('🔙 Close', 'close');
}

export function sniperKeyboard() {
  return new InlineKeyboard()
    .text('🎯 New Sniper', 'sniper_new')
    .text('📋 My Snipers', 'sniper_list')
    .row()
    .text('🔙 Back', 'back_main');
}

export function limitOrdersKeyboard() {
  return new InlineKeyboard()
    .text('➕ New Order', 'limit_new')
    .text('📋 Active Orders', 'limit_active')
    .text('📋 History', 'limit_history')
    .row()
    .text('🔙 Back', 'back_main');
}

export function copyTradeKeyboard() {
  return new InlineKeyboard()
    .text('➕ New Copy', 'copy_new')
    .text('📋 Active Copies', 'copy_list')
    .row()
    .text('🔙 Back', 'back_main');
}

export function settingsKeyboard() {
  return new InlineKeyboard()
    .text('🔧 Default Slippage', 'set_slippage')
    .text('📡 RPC', 'set_rpc')
    .row()
    .text('🔙 Back', 'back_main');
}

export function confirmKeyboard(action: string) {
  return new InlineKeyboard()
    .text('✅ Confirm', `confirm_${action}`)
    .text('❌ Cancel', 'cancel');
}
