import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle, 
  RefreshCw,
  Shield,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../components/ui/collapsible';

const CERTIFICATION_LABELS = {
  ff1: "Firefighter I",
  ff2: "Firefighter II",
  crew_boss: "Crew Boss",
  engine_boss: "Engine Boss",
  mist: "MIST",
  wpu: "WPU",
  astl: "ASTL",
  medl: "MedL",
  tech_spec: "Tech-Spec",
  pack_test: "Pack Test",
  ems: "EMS Certification",
  hazmat_awareness: "HazMat Awareness",
  hazmat_ops: "HazMat Operations",
  rope_rescue: "Rope Rescue",
  swift_water: "Swift Water Rescue",
  driver_operator: "Driver/Operator"
};

const getAlertBadge = (level) => {
  switch (level) {
    case 'expired':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
    case 'critical':
      return <Badge variant="destructive" className="gap-1 bg-red-600"><AlertTriangle className="h-3 w-3" /> Critical</Badge>;
    case 'warning':
      return <Badge variant="warning" className="gap-1 bg-amber-500"><Clock className="h-3 w-3" /> Warning</Badge>;
    case 'upcoming':
      return <Badge variant="secondary" className="gap-1"><Calendar className="h-3 w-3" /> Upcoming</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

export const CertificationAlerts = () => {
  const { api } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/certifications/expiring?days=${days}`);
      setAlerts(response.data.alerts);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Failed to fetch certification alerts:', error);
      toast.error('Failed to load certification alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [days]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Certification Alerts
            </CardTitle>
            <CardDescription>
              Track expiring and expired certifications
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="days" className="text-sm">Show next</Label>
            <Input
              id="days"
              type="number"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 90)}
              className="w-20"
              min={1}
              max={365}
            />
            <span className="text-sm text-muted-foreground">days</span>
            <Button variant="outline" size="sm" onClick={fetchAlerts}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Badges */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium">{summary.expired || 0} Expired</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">{summary.critical || 0} Critical (&lt;30 days)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{summary.warning || 0} Warning (&lt;90 days)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium">{summary.upcoming || 0} Upcoming</span>
          </div>
        </div>

        {/* Alert List */}
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="font-medium">All certifications are up to date!</p>
            <p className="text-sm">No certifications expiring within {days} days.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div 
                key={alert.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  alert.alert_level === 'expired' ? 'bg-red-50 dark:bg-red-900/10 border-red-200' :
                  alert.alert_level === 'critical' ? 'bg-red-50/50 dark:bg-red-900/5 border-red-100' :
                  alert.alert_level === 'warning' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' :
                  'bg-slate-50 dark:bg-slate-800/50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{alert.personnel_name}</p>
                    <p className="text-sm text-muted-foreground">{alert.rank}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">{alert.certification_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {alert.days_until_expiry < 0 
                        ? `Expired ${Math.abs(alert.days_until_expiry)} days ago`
                        : `Expires in ${alert.days_until_expiry} days`
                      }
                    </p>
                  </div>
                  {getAlertBadge(alert.alert_level)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const CertificationEditor = ({ personId, personName, certifications = {}, onSave, onClose }) => {
  const { api } = useAuth();
  const [certs, setCerts] = useState(certifications);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState(['tifmas', 'emtf']);

  const updateCert = (certKey, field, value) => {
    setCerts(prev => ({
      ...prev,
      [certKey]: {
        ...prev[certKey],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/deployment-roster/${personId}/certifications`, certs);
      toast.success('Certifications updated successfully');
      onSave?.(certs);
      onClose?.();
    } catch (error) {
      console.error('Failed to save certifications:', error);
      toast.error('Failed to save certifications');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const renderCertRow = (certKey, label) => {
    const cert = certs[certKey] || { certified: false };
    
    return (
      <div key={certKey} className="flex items-center justify-between py-2 border-b last:border-0">
        <div className="flex items-center gap-3">
          <Switch
            checked={cert.certified || false}
            onCheckedChange={(checked) => updateCert(certKey, 'certified', checked)}
          />
          <Label className="font-medium">{label}</Label>
        </div>
        {cert.certified && (
          <div className="flex items-center gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Cert Date</Label>
              <Input
                type="date"
                value={cert.certification_date || ''}
                onChange={(e) => updateCert(certKey, 'certification_date', e.target.value)}
                className="h-8 w-32"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Expires</Label>
              <Input
                type="date"
                value={cert.expiration_date || ''}
                onChange={(e) => updateCert(certKey, 'expiration_date', e.target.value)}
                className="h-8 w-32"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Manage Certifications
          </DialogTitle>
          <DialogDescription>
            Update certifications and expiration dates for {personName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* TIFMAS Certifications */}
          <Collapsible open={expandedSections.includes('tifmas')} onOpenChange={() => toggleSection('tifmas')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
              <span className="font-semibold text-orange-700 dark:text-orange-400">TIFMAS Certifications</span>
              {expandedSections.includes('tifmas') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 px-2">
              {renderCertRow('ff1', 'Firefighter I (FF1)')}
              {renderCertRow('ff2', 'Firefighter II (FF2)')}
              {renderCertRow('crew_boss', 'Crew Boss')}
              {renderCertRow('engine_boss', 'Engine Boss')}
              {renderCertRow('wpu', 'WPU')}
              {renderCertRow('astl', 'ASTL')}
              {renderCertRow('pack_test', 'Pack Test')}
            </CollapsibleContent>
          </Collapsible>

          {/* EMTF Certifications */}
          <Collapsible open={expandedSections.includes('emtf')} onOpenChange={() => toggleSection('emtf')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
              <span className="font-semibold text-blue-700 dark:text-blue-400">EMTF Certifications</span>
              {expandedSections.includes('emtf') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 px-2">
              {renderCertRow('mist', 'MIST')}
              {renderCertRow('medl', 'MedL')}
              {renderCertRow('tech_spec', 'Tech-Spec')}
              {renderCertRow('ems', 'EMS Certification')}
            </CollapsibleContent>
          </Collapsible>

          {/* Additional Certifications */}
          <Collapsible open={expandedSections.includes('other')} onOpenChange={() => toggleSection('other')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <span className="font-semibold">Additional Certifications</span>
              {expandedSections.includes('other') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 px-2">
              {renderCertRow('hazmat_awareness', 'HazMat Awareness')}
              {renderCertRow('hazmat_ops', 'HazMat Operations')}
              {renderCertRow('rope_rescue', 'Rope Rescue')}
              {renderCertRow('swift_water', 'Swift Water Rescue')}
              {renderCertRow('driver_operator', 'Driver/Operator')}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Certifications'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CertificationAlerts;
