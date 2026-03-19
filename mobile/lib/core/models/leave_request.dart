class LeaveRequest {
  const LeaveRequest({
    required this.id,
    required this.employeeId,
    required this.status,
    required this.start,
    required this.end,
    required this.type,
  });

  final String id;
  final String? employeeId;
  final String status;
  final DateTime? start;
  final DateTime? end;
  final String type;

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    return LeaveRequest(
      id: json['id'].toString(),
      employeeId: json['employeeId']?.toString(),
      status: json['status']?.toString() ?? '',
      start: json['start'] == null ? null : DateTime.tryParse(json['start'].toString()),
      end: json['end'] == null ? null : DateTime.tryParse(json['end'].toString()),
      type: json['type']?.toString() ?? '',
    );
  }
}
