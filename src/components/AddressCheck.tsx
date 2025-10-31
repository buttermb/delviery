import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Zap, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AddressCheckProps {
  onAddressValidated: (isValid: boolean, borough?: string) => void;
}

export default function AddressCheck({ onAddressValidated }: AddressCheckProps) {
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; borough?: string; eta?: string; fee?: string } | null>(null);

  const validateDelivery = () => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      // Complete Brooklyn ZIP codes
      const brooklynZips = [
        "11201", "11202", "11203", "11204", "11205", "11206", "11207", "11208", "11209",
        "11210", "11211", "11212", "11213", "11214", "11215", "11216", "11217", "11218",
        "11219", "11220", "11221", "11222", "11223", "11224", "11225", "11226", "11228",
        "11229", "11230", "11231", "11232", "11233", "11234", "11235", "11236", "11237",
        "11238", "11239", "11240", "11241", "11242", "11243", "11245", "11247", "11249",
        "11251", "11252", "11256"
      ];
      
      // Complete Queens ZIP codes
      const queensZips = [
        "11101", "11102", "11103", "11104", "11105", "11106", "11109", "11351", "11352",
        "11354", "11355", "11356", "11357", "11358", "11359", "11360", "11361", "11362",
        "11363", "11364", "11365", "11366", "11367", "11368", "11369", "11370", "11371",
        "11372", "11373", "11374", "11375", "11377", "11378", "11379", "11385", "11411",
        "11412", "11413", "11414", "11415", "11416", "11417", "11418", "11419", "11420",
        "11421", "11422", "11423", "11426", "11427", "11428", "11429", "11430", "11432",
        "11433", "11434", "11435", "11436", "11691", "11692", "11693", "11694", "11695", "11697"
      ];
      
      // Complete Manhattan ZIP codes
      const manhattanZips = [
        "10001", "10002", "10003", "10004", "10005", "10006", "10007", "10009", "10010",
        "10011", "10012", "10013", "10014", "10016", "10017", "10018", "10019", "10020",
        "10021", "10022", "10023", "10024", "10025", "10026", "10027", "10028", "10029",
        "10030", "10031", "10032", "10033", "10034", "10035", "10036", "10037", "10038",
        "10039", "10040", "10041", "10043", "10044", "10045", "10055", "10060", "10065",
        "10069", "10075", "10090", "10095", "10103", "10104", "10105", "10106", "10107",
        "10110", "10111", "10112", "10115", "10118", "10119", "10120", "10121", "10122",
        "10123", "10128", "10152", "10153", "10154", "10162", "10165", "10167", "10168",
        "10169", "10170", "10171", "10172", "10173", "10174", "10175", "10176", "10177",
        "10178", "10199", "10270", "10271", "10278", "10279", "10280", "10282"
      ];
      
      let valid = false;
      let borough = "";
      let eta = "";
      let fee = "";
      
      if (brooklynZips.includes(zipCode)) {
        valid = true;
        borough = "Brooklyn";
        eta = "30-40 min";
        fee = "FREE over $100";
      } else if (queensZips.includes(zipCode)) {
        valid = true;
        borough = "Queens";
        eta = "35-45 min";
        fee = "$7 (FREE over $100)";
      } else if (manhattanZips.includes(zipCode)) {
        valid = true;
        borough = "Manhattan";
        eta = "25-35 min";
        fee = "$10 (FREE over $100)";
      }
      
      setResult({ valid, borough, eta, fee });
      onAddressValidated(valid, borough.toLowerCase());
      setLoading(false);
    }, 800);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-teal-500/30 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase tracking-wide text-white">Check Delivery</h3>
            <p className="text-sm text-slate-300">Enter your ZIP to see availability</p>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <Input
            type="text"
            placeholder="Enter NYC ZIP Code"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value.slice(0, 5))}
            maxLength={5}
            className="text-lg h-14 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400"
          />
          <Button
            onClick={validateDelivery}
            disabled={zipCode.length !== 5 || loading}
            className="h-14 px-8 bg-teal-500 hover:bg-teal-600 text-white font-bold uppercase tracking-wide"
          >
            {loading ? "Checking..." : "Check"}
          </Button>
        </div>

        {result && (
          <div className={`p-6 rounded-xl ${result.valid ? 'bg-teal-500/10 border border-teal-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
            {result.valid ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center">
                    <span className="text-white text-lg">✓</span>
                  </div>
                  <h4 className="text-xl font-black text-white">We Deliver to {result.borough}!</h4>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                    <Clock className="w-5 h-5 text-teal-400" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Delivery Time</p>
                      <p className="font-bold text-white">{result.eta}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg">
                    <Zap className="w-5 h-5 text-teal-400" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Delivery Fee</p>
                      <p className="font-bold text-white">{result.fee}</p>
                    </div>
                  </div>
                </div>

                <Badge className="w-full justify-center py-3 bg-teal-500/20 text-teal-300 border-teal-500/30">
                  Express delivery available for $10 extra (15-20 min)
                </Badge>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-lg font-bold text-red-400 mb-2">Sorry, we don't deliver to this area yet</p>
                <p className="text-sm text-slate-400">We currently serve Brooklyn, Queens, and Manhattan only</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
