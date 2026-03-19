class Employee {
  const Employee({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    this.department,
    this.site,
    this.position,
    this.status,
    this.managerId,
  });

  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String? department;
  final String? site;
  final String? position;
  final String? status;
  final String? managerId;

  String get fullName => '$firstName $lastName';

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      id: json['id'].toString(),
      firstName: json['firstName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      department: json['department']?.toString(),
      site: json['site']?.toString(),
      position: json['position']?.toString(),
      status: json['status']?.toString(),
      managerId: json['managerId']?.toString(),
    );
  }
}
