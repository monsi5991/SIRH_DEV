import 'package:sirh_mobile/core/models/user_model.dart';

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.idToken,
    required this.user,
  });

  final String accessToken;
  final String? refreshToken;
  final String? idToken;
  final UserModel user;

  String get homeLocation {
    if (user.isHr) return '/hr/dashboard';
    if (user.isManager) return '/manager/dashboard';
    return '/employee/dashboard';
  }
}
