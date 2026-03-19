import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:sirh_mobile/core/config/app_config.dart';

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService(const FlutterSecureStorage());
});

class SecureStorageService {
  SecureStorageService(this._storage);

  final FlutterSecureStorage _storage;

  String get _accessTokenKey => '${AppConfig.instance.storageKeyPrefix}access_token';
  String get _refreshTokenKey => '${AppConfig.instance.storageKeyPrefix}refresh_token';
  String get _idTokenKey => '${AppConfig.instance.storageKeyPrefix}id_token';

  Future<void> saveTokens({
    required String accessToken,
    required String? refreshToken,
    required String? idToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
    await _storage.write(key: _idTokenKey, value: idToken);
  }

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);
  Future<String?> readIdToken() => _storage.read(key: _idTokenKey);

  Future<void> clear() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _idTokenKey);
  }
}
