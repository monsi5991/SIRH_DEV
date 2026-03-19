import 'package:dio/dio.dart';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/core/config/app_config.dart';
import 'package:sirh_mobile/core/models/auth_session.dart';
import 'package:sirh_mobile/core/models/user_model.dart';
import 'package:sirh_mobile/core/storage/secure_storage_service.dart';

final keycloakAuthRepositoryProvider = Provider<KeycloakAuthRepository>((ref) {
  return KeycloakAuthRepository(
    appAuth: const FlutterAppAuth(),
    storage: ref.watch(secureStorageServiceProvider),
  );
});

class KeycloakAuthRepository {
  KeycloakAuthRepository({
    required FlutterAppAuth appAuth,
    required SecureStorageService storage,
  })  : _appAuth = appAuth,
        _storage = storage;

  final FlutterAppAuth _appAuth;
  final SecureStorageService _storage;

  AuthorizationServiceConfiguration get _serviceConfiguration {
    final issuer = AppConfig.instance.issuer;
    return AuthorizationServiceConfiguration(
      authorizationEndpoint: '$issuer/protocol/openid-connect/auth',
      tokenEndpoint: '$issuer/protocol/openid-connect/token',
      endSessionEndpoint: '$issuer/protocol/openid-connect/logout',
    );
  }

  Future<AuthSession?> restoreSession() async {
    final accessToken = await _storage.readAccessToken();
    if (accessToken == null || accessToken.isEmpty) return null;

    final user = await _fetchProfile(accessToken);
    if (user == null) {
      await _storage.clear();
      return null;
    }

    return AuthSession(
      accessToken: accessToken,
      refreshToken: await _storage.readRefreshToken(),
      idToken: await _storage.readIdToken(),
      user: user,
    );
  }

  Future<AuthSession> login() async {
    final token = await _appAuth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(
        AppConfig.instance.keycloakClientId,
        AppConfig.instance.oidcRedirectUri,
        serviceConfiguration: _serviceConfiguration,
        scopes: const <String>['openid', 'profile', 'email'],
      ),
    );

    if (token == null || token.accessToken == null) {
      throw StateError('Authentification Keycloak annulee.');
    }

    final user = await _fetchProfile(token.accessToken!);
    if (user == null) {
      throw StateError('Profil SIRH introuvable pour ce compte.');
    }

    await _storage.saveTokens(
      accessToken: token.accessToken!,
      refreshToken: token.refreshToken,
      idToken: token.idToken,
    );

    return AuthSession(
      accessToken: token.accessToken!,
      refreshToken: token.refreshToken,
      idToken: token.idToken,
      user: user,
    );
  }

  Future<void> logout() => _storage.clear();

  Future<UserModel?> _fetchProfile(String accessToken) async {
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.instance.apiBaseUrl,
        headers: <String, dynamic>{'Authorization': 'Bearer $accessToken'},
      ),
    );

    try {
      final response = await dio.get<Map<String, dynamic>>('/me');
      final payload = response.data ?? const <String, dynamic>{};
      final rawUser = payload['user'] as Map<String, dynamic>?;
      if (rawUser == null) return null;
      return UserModel.fromMeResponse(rawUser);
    } on DioException {
      return null;
    }
  }
}
