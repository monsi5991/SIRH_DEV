// frontend/src/pages/auth/LoginPage.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, Lock, Building2, Eye, EyeOff, ArrowRight, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';

const LoginPage = () => {
  const { login, authLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('rh');
  const [credentials, setCredentials] = useState({ email: '', password: '' });

  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleLogin = async (e) => {
    e.preventDefault();
    const { success, error } = await login(credentials.email, credentials.password);
    if (success) {
      navigate(from, { replace: true });
    } else {
      window.alert(error || 'Identifiants incorrects');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">SIRH Panafrica</h1>
          <p className="text-gray-600">Connectez-vous à votre espace de travail</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="rh" className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  RH Manager
                </TabsTrigger>
                <TabsTrigger value="employee" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Employé
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Adresse email</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={credentials.email}
                    onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bouton */}
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="lg"
                disabled={authLoading}
              >
                {authLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connexion...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Se connecter
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>SIRH Panafrica © 2025 • Tous droits réservés</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <Badge variant="outline" className="text-xs">🇸🇳 Sénégal</Badge>
            <Badge variant="outline" className="text-xs">🇧🇫 Burkina Faso</Badge>
            <Badge variant="outline" className="text-xs">🇬🇳 Guinée</Badge>
            <Badge variant="outline" className="text-xs">🇨🇮 Côte d&apos;Ivoire</Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
