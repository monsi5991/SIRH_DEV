import 'package:sirh_mobile/core/config/app_config.dart';

class AppLogger {
  const AppLogger._();

  static void debug(String tag, String message) {
    if (AppConfig.instance.enableLogs) {
      // ignore: avoid_print
      print('[$tag] $message');
    }
  }

  static void error(String tag, Object error) {
    if (AppConfig.instance.enableLogs) {
      // ignore: avoid_print
      print('[$tag][ERROR] $error');
    }
  }
}
