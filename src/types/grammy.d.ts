import 'grammy';

declare module 'grammy' {
  interface Context {
    message_id?: number;
  }
}
