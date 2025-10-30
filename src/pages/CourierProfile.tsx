import { useEffect } from 'react';
import { useCourier } from '@/contexts/CourierContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, Car, Star, TrendingUp, LogOut, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { NotificationTest } from '@/components/NotificationTest';

export default function CourierProfile() {
  const { courier, loading } = useCourier();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/courier/login');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  if (!courier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="p-6">
          <button
            onClick={() => navigate('/courier/dashboard')}
            className="flex items-center text-white mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <h1 className="text-2xl font-bold mb-2">👤 My Profile</h1>
          <p className="text-blue-100">Manage your courier account</p>
        </div>
      </div>

      <div className="p-4">
        {/* Profile Photo */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4 text-center">
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
              {courier.full_name?.charAt(0).toUpperCase()}
            </div>
            <button className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg border-2 border-blue-600">
              <Camera className="w-4 h-4 text-blue-600" />
            </button>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{courier.full_name}</h2>
          <div className="flex items-center justify-center gap-2 text-yellow-500">
            <Star className="w-5 h-5 fill-current" />
            <span className="font-bold text-lg">{courier.rating?.toFixed(1)}</span>
            <span className="text-gray-500 text-sm">({courier.total_deliveries || 0} deliveries)</span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl p-4 shadow">
            <TrendingUp className="w-6 h-6 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{courier.on_time_rate?.toFixed(0)}%</p>
            <p className="text-xs text-gray-600">On-Time Rate</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow">
            <Star className="w-6 h-6 text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-gray-900">{courier.commission_rate}%</p>
            <p className="text-xs text-gray-600">Commission</p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          <h3 className="font-bold text-lg mb-4">Contact Information</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{courier.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">{courier.phone}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          <h3 className="font-bold text-lg mb-4">Vehicle Information</h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <Car className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Vehicle Type</p>
              <p className="font-medium text-gray-900 capitalize">{courier.vehicle_type}</p>
            </div>
          </div>
          {courier.vehicle_make && courier.vehicle_model && (
            <div className="text-sm text-gray-600">
              <p><strong>Make/Model:</strong> {courier.vehicle_make} {courier.vehicle_model}</p>
            </div>
          )}
          {courier.vehicle_plate && (
            <div className="text-sm text-gray-600 mt-2">
              <p><strong>Plate:</strong> {courier.vehicle_plate}</p>
            </div>
          )}
          {courier.license_number && (
            <div className="text-sm text-gray-600 mt-2">
              <p><strong>License:</strong> {courier.license_number}</p>
            </div>
          )}
        </div>

        {/* Notification Test */}
        <div className="mb-4">
          <NotificationTest />
        </div>

        {/* Account Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full h-12"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}
