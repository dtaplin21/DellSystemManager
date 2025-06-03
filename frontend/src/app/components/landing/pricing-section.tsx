'use client';

import Link from 'next/link';

export default function PricingSection() {
  const plans = [
    {
      name: "Basic",
      price: "$115",
      period: "per month",
      description: "Perfect for small teams and individual professionals",
      features: [
        "Up to 5 active projects",
        "Basic QC automation",
        "Standard panel optimization",
        "Document storage (10GB)",
        "Email support",
        "Basic reporting"
      ],
      buttonText: "Start Basic Plan",
      buttonStyle: "border border-navy-600 text-navy-600 hover:bg-navy-600 hover:text-white"
    },
    {
      name: "Premium",
      price: "$315",
      period: "per month",
      description: "Advanced features for professional teams and enterprises",
      features: [
        "Unlimited projects",
        "Advanced AI automation",
        "Premium panel optimization",
        "Unlimited document storage",
        "Priority phone & email support",
        "Advanced analytics & reporting",
        "Custom integrations",
        "Team collaboration tools"
      ],
      buttonText: "Start Premium Plan",
      buttonStyle: "bg-orange-600 text-white hover:bg-orange-700",
      popular: true
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-navy-900 mb-4">
            Professional Pricing Plans
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your project needs and team size
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div key={index} className={`bg-white rounded-lg p-8 shadow-lg relative ${plan.popular ? 'ring-2 ring-orange-500' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-orange-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-navy-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-navy-900">{plan.price}</span>
                  <span className="text-gray-600 ml-2">{plan.period}</span>
                </div>
                <p className="text-gray-600">{plan.description}</p>
              </div>
              
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Link 
                href="/signup" 
                className={`w-full block text-center px-6 py-3 rounded-lg font-semibold transition-colors ${plan.buttonStyle}`}
              >
                {plan.buttonText}
              </Link>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">All plans include 30-day free trial • No setup fees • Cancel anytime</p>
          <Link href="/login" className="text-navy-600 hover:text-navy-800 font-semibold">
            Already have an account? Sign in →
          </Link>
        </div>
      </div>
    </section>
  );
}