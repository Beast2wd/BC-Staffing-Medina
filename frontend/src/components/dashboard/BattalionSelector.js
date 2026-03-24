import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useStaffing } from '../../context/StaffingContext';
import { Label } from '../ui/label';

export const BattalionSelector = () => {
  const { 
    selectedBattalion, 
    setSelectedBattalion, 
    battalions, 
    fetchBattalions 
  } = useStaffing();

  useEffect(() => {
    fetchBattalions();
  }, [fetchBattalions]);

  const selectedBattalionData = battalions.find(b => b.id === selectedBattalion);

  return (
    <div className="flex items-center gap-4" data-testid="battalion-selector">
      <Label className="font-heading text-sm uppercase tracking-wider whitespace-nowrap">
        Battalion:
      </Label>
      <Select value={selectedBattalion} onValueChange={setSelectedBattalion}>
        <SelectTrigger className="w-48" data-testid="battalion-select">
          <SelectValue placeholder="Select Battalion">
            {selectedBattalionData?.battalion_number || 'Select Battalion'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {battalions.map((battalion) => (
            <SelectItem 
              key={battalion.id} 
              value={battalion.id}
              data-testid={`battalion-option-${battalion.battalion_number}`}
            >
              Battalion {battalion.battalion_number}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
