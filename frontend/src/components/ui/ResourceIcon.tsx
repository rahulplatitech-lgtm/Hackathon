import { Ambulance, Shield, Users, Building2, Tent } from 'lucide-react';

const ICONS: Record<string, typeof Ambulance> = {
  AMBULANCE: Ambulance, POLICE_UNIT: Shield, RESCUE_TEAM: Users,
  MEDICAL_UNIT: Building2, SHELTER: Tent,
};

export default function ResourceIcon({ type, className = 'w-4 h-4' }: { type: string; className?: string }) {
  const Icon = ICONS[type] || Shield;
  return <Icon className={className} />;
}
