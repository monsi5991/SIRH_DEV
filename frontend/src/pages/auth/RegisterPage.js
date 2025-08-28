// src/pages/auth/RegisterPage.js
import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Mail, Building2, MapPin, Eye, EyeOff, ArrowRight, Phone, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const RegisterPage = () => {
  const { language, setLanguage } = useApp();
  const { register, authLoading } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('company');
  const [formData, setFormData] = useState({
    companyName: '', country: 'SN', city: '', industry: '', size: '',
    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', role: 'Admin'
  });

  const companySizes = [
    { value: '1-10', label: language === 'fr' ? '1-10 employés' : '1-10 employees' },
    { value: '11-50', label: language === 'fr' ? '11-50 employés' : '11-50 employees' },
    { value: '51-200', label: language === 'fr' ? '51-200 employés' : '51-200 employees' },
    { value: '201-1000', label: language === 'fr' ? '201-1000 employés' : '201-1000 employees' },
    { value: '1000+', label: language === 'fr' ? '1000+ employés' : '1000+ employees' }
  ];
  const industries = [
    { value: 'tech', label: 'Technologie' },
    { value: 'finance', label: 'Finance/Banque' },
    { value: 'retail', label: 'Commerce/Retail' },
    { value: 'manufacturing', label: 'Industrie/Manufacturing' },
    { value: 'services', label: 'Services' },
    { value: 'healthcare', label: 'Santé' },
    { value: 'education', label: 'Éducation' },
    { value: 'other', label: 'Autre' }
  ];

  const update = (k, v) => setFormData((f) => ({ ...f, [k]: v }));
  const toggleLanguage = () => setLanguage(language === 'fr' ? 'en' : 'fr');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      return window.alert(language === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match');
    }
    const payload = { ...formData };
    delete payload.confirmPassword;
    const { success, error } = await register(payload);
    if (success) navigate("/", { replace: true });
    else window.alert(error || (language === 'fr' ? "Erreur d’inscription" : 'Registration error'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-6">
          <Button variant="ghost" size="sm" onClick={toggleLanguage} className="text-gray-600 hover:text-gray-900">
            {language.toUpperCase()} | {language === 'fr' ? 'EN' : 'FR'}
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {language === 'fr' ? 'Créer votre compte SIRH' : 'Create your HRIS account'}
          </h1>
          <p className="text-gray-600">
            {language === 'fr' ? 'Démarrez votre transformation RH en quelques minutes' : 'Start your HR transformation in minutes'}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">
              {language === 'fr' ? 'Inscription Entreprise' : 'Company Registration'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="company" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {language === 'fr' ? 'Entreprise' : 'Company'}
                  </TabsTrigger>
                  <TabsTrigger value="admin" className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4" />
                    {language === 'fr' ? 'Administrateur' : 'Administrator'}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="company" className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? "Nom de l&apos;entreprise" : 'Company name'} *
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.companyName}
                          onChange={(e) => update('companyName', e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder={language === 'fr' ? 'Ex: Acme Sénégal SA' : 'Ex: Acme Senegal SA'}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? 'Pays' : 'Country'} *
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) => update('country', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        <option value="SN">🇸🇳 Sénégal</option>
                        <option value="BF">🇧🇫 Burkina Faso</option>
                        <option value="GN">🇬🇳 Guinée</option>
                        <option value="CI">🇨🇮 Côte d&apos;Ivoire</option>
                        <option value="BJ">🇧🇯 Bénin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? 'Ville' : 'City'} *
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => update('city', e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Ex: Dakar"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? "Secteur d&apos;activité" : 'Industry'} *
                      </label>
                      <select
                        value={formData.industry}
                        onChange={(e) => update('industry', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        <option value="">{language === 'fr' ? 'Sélectionner...' : 'Select...'}</option>
                        {industries.map(ind => (<option key={ind.value} value={ind.value}>{ind.label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? "Taille de l&apos;entreprise" : 'Company size'} *
                      </label>
                      <select
                        value={formData.size}
                        onChange={(e) => update('size', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        <option value="">{language === 'fr' ? 'Sélectionner...' : 'Select...'}</option>
                        {companySizes.map(s => (<option key={s.value} value={s.value}>{s.label}</option>))}
                      </select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin" className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? 'Prénom' : 'First name'} *
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => update('firstName', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? 'Nom' : 'Last name'} *
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => update('lastName', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? 'Email professionnel' : 'Business email'} *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => update('email', e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="admin@votre-entreprise.com"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? 'Téléphone' : 'Phone'}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => update('phone', e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="+221 77 123 45 67"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? 'Mot de passe' : 'Password'} *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => update('password', e.target.value)}
                          className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="••••••••"
                          required
                          minLength={8}
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'} *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => update('confirmPassword', e.target.value)}
                          className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" required className="mt-1" />
                      <span className="text-sm text-gray-700">
                        {language === 'fr'
                          ? "J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité"
                          : 'I agree to the terms of service and privacy policy'}
                      </span>
                    </label>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-8">
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg" disabled={authLoading}>
                  {authLoading
                    ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {language === 'fr' ? 'Création en cours...' : 'Creating account...'}
                      </div>
                    )
                    : (
                      <div className="flex items-center gap-2">
                        {language === 'fr' ? 'Créer mon compte' : 'Create account'}
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                </Button>
              </div>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-gray-600">
                {language === 'fr' ? 'Déjà un compte ?' : 'Already have an account?'}{' '}
              </span>
              <button onClick={() => navigate('/login')} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                {language === 'fr' ? 'Se connecter' : 'Sign in'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
export default RegisterPage;
