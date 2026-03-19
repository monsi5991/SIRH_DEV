import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  AppConfig._({
    required this.env,
    required this.appName,
    required this.apiBaseUrl,
    required this.wsBaseUrl,
    required this.keycloakUrl,
    required this.keycloakRealm,
    required this.keycloakClientId,
    required this.oidcRedirectUri,
    required this.enableLogs,
    required this.enableDebugOverlay,
    required this.cacheDurationMinutes,
    required this.syncIntervalMinutes,
  });

  static AppConfig? _instance;

  static AppConfig get instance {
    final value = _instance;
    if (value == null) {
      throw StateError('AppConfig non initialise. Appeler AppConfig.load() avant runApp().');
    }
    return value;
  }

  final String env;
  final String appName;
  final String apiBaseUrl;
  final String wsBaseUrl;
  final String keycloakUrl;
  final String keycloakRealm;
  final String keycloakClientId;
  final String oidcRedirectUri;
  final bool enableLogs;
  final bool enableDebugOverlay;
  final int cacheDurationMinutes;
  final int syncIntervalMinutes;

  static Future<void> load(String envFile) async {
    await dotenv.load(fileName: envFile);
    _instance = AppConfig._(
      env: dotenv.env['APP_ENV'] ?? 'dev',
      appName: dotenv.env['APP_NAME'] ?? 'SIRH Mobile',
      apiBaseUrl: dotenv.env['API_BASE_URL'] ?? 'http://localhost:4000',
      wsBaseUrl: dotenv.env['WS_BASE_URL'] ?? '',
      keycloakUrl: dotenv.env['KEYCLOAK_URL'] ?? 'http://localhost:8080',
      keycloakRealm: dotenv.env['KEYCLOAK_REALM'] ?? 'SIRH-dev',
      keycloakClientId: dotenv.env['KEYCLOAK_CLIENT_ID'] ?? 'sirh-mobile-dev',
      oidcRedirectUri: dotenv.env['OIDC_REDIRECT_URI'] ?? 'com.sirh.mobile.dev:/oauthredirect',
      enableLogs: (dotenv.env['ENABLE_LOGS'] ?? 'true') == 'true',
      enableDebugOverlay: (dotenv.env['ENABLE_DEBUG_OVERLAY'] ?? 'false') == 'true',
      cacheDurationMinutes: int.tryParse(dotenv.env['CACHE_DURATION_MINUTES'] ?? '') ?? 5,
      syncIntervalMinutes: int.tryParse(dotenv.env['SYNC_INTERVAL_MINUTES'] ?? '') ?? 5,
    );
  }

  String get issuer => '$keycloakUrl/realms/$keycloakRealm';
  bool get isProd => env == 'prod';
  String get storageKeyPrefix => 'sirh_${env}_';
}
