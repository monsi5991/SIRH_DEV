import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/core/auth/keycloak_auth_repository.dart';
import 'package:sirh_mobile/core/models/auth_session.dart';

final authControllerProvider =
    StateNotifierProvider<AuthController, AsyncValue<AuthSession?>>((ref) {
  return AuthController(ref.watch(keycloakAuthRepositoryProvider));
});

class AuthController extends StateNotifier<AsyncValue<AuthSession?>> {
  AuthController(this._repository) : super(const AsyncLoading()) {
    restoreSession();
  }

  final KeycloakAuthRepository _repository;

  Future<void> restoreSession() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_repository.restoreSession);
  }

  Future<void> login() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_repository.login);
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AsyncData(null);
  }
}
