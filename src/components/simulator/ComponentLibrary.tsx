import { useState } from 'react';
import { componentsByCategory, categoryNames } from '@/data/componentDefinitions';
import { ComponentDefinition } from '@/types/simulator';
import { useSimulatorStore } from '@/store/simulatorStore';
import { 
  Cpu, 
  Thermometer, 
  Lightbulb, 
  Wifi, 
  Server,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn, createId } from '@/lib/utils';

const categoryIcons: Record<string, React.ReactNode> = {
  mainboard: <Cpu className="h-4 w-4" />,
  sensor: <Thermometer className="h-4 w-4" />,
  actuator: <Lightbulb className="h-4 w-4" />,
  network: <Wifi className="h-4 w-4" />,
  server: <Server className="h-4 w-4" />,
};

interface ComponentLibraryProps {
  onDragStart?: (definition: ComponentDefinition) => void;
}

export function ComponentLibrary({ onDragStart }: ComponentLibraryProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    Object.keys(categoryNames)
  );
  const addComponent = useSimulatorStore((state) => state.addComponent);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    definition: ComponentDefinition
  ) => {
    e.dataTransfer.setData('component-definition', JSON.stringify(definition));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart?.(definition);
  };

  const handleDoubleClick = (definition: ComponentDefinition) => {
    const newComponent = {
      instanceId: createId(),
      definitionId: definition.id,
      position: { x: 200 + Math.random() * 100, y: 150 + Math.random() * 100 },
      state: {
        powered: false,
        active: false,
      },
    };
    addComponent(newComponent);
  };

  return (
    <div className="h-full overflow-y-auto bg-card border-r border-border">
      <div className="p-3 border-b border-border">
        <h2 className="font-semibold text-sm text-foreground">组件库</h2>
        <p className="text-xs text-muted-foreground mt-1">拖拽组件到画布</p>
      </div>
      
      <div className="p-2 space-y-1">
        {Object.entries(componentsByCategory).map(([category, components]) => (
          <div key={category} className="rounded-md overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground hover:bg-accent rounded-md transition-colors"
            >
              {expandedCategories.includes(category) ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              {categoryIcons[category]}
              <span>{categoryNames[category]}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {components.length}
              </span>
            </button>
            
            {expandedCategories.includes(category) && (
              <div className="pl-4 pr-2 pb-2 space-y-1">
                {components.map((component) => (
                  <div
                    key={component.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, component)}
                    onDoubleClick={() => handleDoubleClick(component)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md cursor-grab",
                      "bg-muted/50 hover:bg-muted transition-colors",
                      "border border-transparent hover:border-border",
                      "active:cursor-grabbing active:scale-95"
                    )}
                  >
                    <ComponentIcon type={component.type} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {component.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {component.pins.length} 引脚
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ComponentIcon({ type }: { type: string }) {
  const iconClasses = "h-8 w-8 p-1.5 rounded bg-primary/10 text-primary";
  
  switch (type) {
    case 'microbit':
      return (
        <div className={iconClasses}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="7" cy="12" r="2" />
            <circle cx="17" cy="12" r="2" />
            <rect x="10" y="9" width="4" height="6" rx="0.5" />
          </svg>
        </div>
      );
    case 'expansion-board':
      return (
        <div className={iconClasses}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="20" height="16" rx="1" />
            <line x1="6" y1="20" x2="6" y2="22" />
            <line x1="10" y1="20" x2="10" y2="22" />
            <line x1="14" y1="20" x2="14" y2="22" />
            <line x1="18" y1="20" x2="18" y2="22" />
          </svg>
        </div>
      );
    case 'temp-humidity-sensor':
      return (
        <div className={iconClasses}>
          <Thermometer className="h-full w-full" />
        </div>
      );
    case 'light-sensor':
      return (
        <div className={iconClasses}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        </div>
      );
    case 'led-strip':
    case 'buzzer':
      return (
        <div className={iconClasses}>
          <Lightbulb className="h-full w-full" />
        </div>
      );
    case 'obloq':
    case 'router':
      return (
        <div className={iconClasses}>
          <Wifi className="h-full w-full" />
        </div>
      );
    case 'pc-server':
    case 'database':
    case 'browser':
      return (
        <div className={iconClasses}>
          <Server className="h-full w-full" />
        </div>
      );
    default:
      return (
        <div className={iconClasses}>
          <Cpu className="h-full w-full" />
        </div>
      );
  }
}
