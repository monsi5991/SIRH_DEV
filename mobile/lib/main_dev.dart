import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sirh_mobile/app.dart';
import 'package:sirh_mobile/core/config/app_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.load('.env.dev');
  runApp(const ProviderScope(child: SirhApp()));
}
