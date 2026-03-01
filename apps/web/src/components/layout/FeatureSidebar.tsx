type FeatureSidebarProps = {
  isOpen: boolean;
  activeFeature: string;
  roleFeatures: Array<{ key: string; label: string }>;
  onSelect: (feature: string) => void;
};

export default function FeatureSidebar(props: FeatureSidebarProps) {
  if (!props.isOpen) return null;

  return (
    <aside className="featureSidebar">
      <h4>Features</h4>
      <div className="featureList">
        {props.roleFeatures.map((feature) => (
          <button
            key={feature.key}
            className={`featureItem ${props.activeFeature === feature.key ? "active" : ""}`}
            onClick={() => props.onSelect(feature.key)}
          >
            {feature.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
