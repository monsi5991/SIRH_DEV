enum UserRole { hr, manager, employee, unknown }

class UserModel {
  const UserModel({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.roles,
    required this.permissions,
    required this.tenantId,
    required this.tenantName,
    this.employeeId,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final List<UserRole> roles;
  final List<String> permissions;
  final String tenantId;
  final String tenantName;
  final String? employeeId;

  String get fullName => '$firstName $lastName';

  bool get isHr => roles.contains(UserRole.hr);
  bool get isManager => roles.contains(UserRole.manager);
  bool get isEmployee => roles.contains(UserRole.employee);

  static UserRole _parseRole(String value) {
    switch (value.toUpperCase()) {
      case 'HR':
      case 'RH':
      case 'ADMIN':
        return UserRole.hr;
      case 'MANAGER':
        return UserRole.manager;
      case 'EMPLOYEE':
        return UserRole.employee;
      default:
        return UserRole.unknown;
    }
  }

  factory UserModel.fromMeResponse(Map<String, dynamic> json) {
    final tenant = (json['tenant'] as Map<String, dynamic>? ?? const <String, dynamic>{});
    final rawRoles = (json['roles'] as List<dynamic>? ?? const <dynamic>[])
        .map((item) => item.toString())
        .toList(growable: false);

    return UserModel(
      id: json['id'].toString(),
      email: json['email'].toString(),
      firstName: json['firstName'].toString(),
      lastName: json['lastName'].toString(),
      roles: rawRoles.map(_parseRole).toList(growable: false),
      permissions: (json['permissions'] as List<dynamic>? ?? const <dynamic>[])
          .map((item) => item.toString())
          .toList(growable: false),
      tenantId: tenant['id']?.toString() ?? json['tenantId']?.toString() ?? '',
      tenantName: tenant['name']?.toString() ?? 'Organisation',
      employeeId: json['employeeId']?.toString(),
    );
  }
}
