import 'package:intl/intl.dart';

class DateFormatter {
  const DateFormatter._();

  static final DateFormat _short = DateFormat('dd/MM/yyyy', 'fr_FR');
  static final DateFormat _dateTime = DateFormat('dd/MM/yyyy HH:mm', 'fr_FR');

  static String short(DateTime value) => _short.format(value);
  static String dateTime(DateTime value) => _dateTime.format(value);
}
