'use client';

export default function FeaturesSection() {
  const features = [
    {
      title: "AI-Powered QC Automation",
      description: "Automated anomaly detection and intelligent data analysis reduce manual review time by up to 80%",
      icon: "🤖"
    },
    {
      title: "Panel Layout Optimization",
      description: "Advanced algorithms optimize panel placement for maximum efficiency and cost savings",
      icon: "📐"
    },
    {
      title: "Document Management",
      description: "Centralized storage and AI-powered document analysis streamline project documentation",
      icon: "📁"
    },
    {
      title: "Real-time Monitoring",
      description: "Live project tracking with instant notifications for critical QC events",
      icon: "📊"
    },
    {
      title: "Compliance Reporting",
      description: "Automated generation of industry-standard compliance reports and certifications",
      icon: "✅"
    },
    {
      title: "Team Collaboration",
      description: "Multi-user access with role-based permissions for seamless team coordination",
      icon: "👥"
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-navy-900 mb-4">
            Powerful Features for Professional QC
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to manage geosynthetic projects efficiently and professionally
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-navy-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}