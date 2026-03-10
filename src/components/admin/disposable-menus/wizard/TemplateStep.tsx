import { MenuTemplates, type MenuTemplate } from '@/components/admin/disposable-menus/MenuTemplates';

interface TemplateStepProps {
  selectedTemplateId: string | undefined;
  onSelectTemplate: (template: MenuTemplate) => void;
}

export const TemplateStep = ({ selectedTemplateId, onSelectTemplate }: TemplateStepProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Choose a Template</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Select a template to quickly configure your menu settings, or choose Custom to start from scratch.
      </p>
      <MenuTemplates
        onSelectTemplate={onSelectTemplate}
        selectedTemplateId={selectedTemplateId}
      />
    </div>
  );
};
