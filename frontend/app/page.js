'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const platformsData = [
  {
    id: 'netflix',
    name: 'Netflix',
    description: 'Watch movies, TV shows, and anime in high quality.',
    className: 'border-red-600 border-t-4',
    color: '#e50914',
    brandMark: 'N',
    logoText: 'NETFLIX',
    logoSubtext: 'Originals',
    logoClass: 'from-red-600 to-red-500',
    watermarkText: 'NETFLIX',
    plans: [
      { name: 'Mobile', price: 250, details: '1 Screen, Mobile/Tablet (480p)' },
      { name: 'Basic', price: 500, details: '1 Screen, All devices (720p)' },
      { name: 'Standard', price: 800, details: '2 Screens, All devices (1080p, Full HD)' },
      { name: 'Premium UHD', price: 1100, details: '4 Screens, All devices (4K + HDR)', popular: true }
    ]
  },
  {
    id: 'prime',
    name: 'Amazon Prime',
    description: 'Unlimited streaming of movies, series, and Prime music.',
    className: 'border-cyan-400 border-t-4',
    color: '#00a8e1',
    brandMark: 'P',
    logoText: 'prime video',
    logoSubtext: 'Amazon',
    logoClass: 'from-sky-500 to-cyan-400',
    watermarkText: 'prime',
    plans: [
      { name: 'Mobile', price: 200, details: '1 Screen, Mobile only (480p)' },
      { name: 'Basic', price: 400, details: '1 Screen, All devices (720p)' },
      { name: 'Standard', price: 600, details: '2 Screens, All devices (1080p)' },
      { name: 'Premium UHD', price: 800, details: '4 Screens, All devices (4K + HDR)', popular: true }
    ]
  },
  {
    id: 'sonyliv',
    name: 'SonyLIV',
    description: 'Watch live sports, original web series, and movies.',
    className: 'border-amber-500 border-t-4',
    color: '#e2a826',
    brandMark: 'S',
    logoText: 'SonyLIV',
    logoSubtext: 'Sports + Originals',
    logoClass: 'from-amber-500 via-orange-500 to-fuchsia-600',
    watermarkText: 'LIV',
    plans: [
      { name: 'Mobile', price: 150, details: '1 Screen, Mobile only (SD)' },
      { name: 'Basic', price: 300, details: '1 Screen, All devices (720p)' },
      { name: 'Standard', price: 450, details: '2 Screens, All devices (1080p)' },
      { name: 'Premium UHD', price: 600, details: '4 Screens, All devices (4K)', popular: true }
    ]
  },
  {
    id: 'zee5',
    name: 'Zee5',
    description: 'Stream popular TV shows, regional blockbusters, and originals.',
    className: 'border-purple-600 border-t-4',
    color: '#8230c4',
    brandMark: 'Z',
    logoText: 'ZEE5',
    logoSubtext: 'Regional + Movies',
    logoClass: 'from-violet-600 via-fuchsia-500 to-rose-500',
    watermarkText: 'ZEE5',
    plans: [
      { name: 'Mobile', price: 100, details: '1 Screen, Mobile only (SD)' },
      { name: 'Basic', price: 200, details: '1 Screen, All devices (720p)' },
      { name: 'Standard', price: 350, details: '2 Screens, All devices (1080p)' },
      { name: 'Premium UHD', price: 500, details: '4 Screens, All devices (4K)', popular: true }
    ]
  }
];

const brandColors = {
  netflix: { border: 'border-red-200 bg-red-50 hover:bg-red-100/70', borderActive: 'border-red-500 shadow-[0_18px_38px_-28px_rgba(239,68,68,0.65)] bg-red-50', text: 'text-red-600 border-red-200', surface: 'linear-gradient(135deg, #ffe4e6 0%, #fff1f2 62%, #ffffff 100%)' },
  prime: { border: 'border-cyan-200 bg-cyan-50 hover:bg-cyan-100/70', borderActive: 'border-cyan-500 shadow-[0_18px_38px_-28px_rgba(6,182,212,0.65)] bg-cyan-50', text: 'text-cyan-600 border-cyan-200', surface: 'linear-gradient(135deg, #e0f2fe 0%, #ecfeff 62%, #ffffff 100%)' },
  sonyliv: { border: 'border-amber-200 bg-amber-50 hover:bg-amber-100/70', borderActive: 'border-amber-500 shadow-[0_18px_38px_-28px_rgba(245,158,11,0.65)] bg-amber-50', text: 'text-amber-600 border-amber-200', surface: 'linear-gradient(135deg, #fef3c7 0%, #fff7ed 55%, #ffffff 100%)' },
  zee5: { border: 'border-purple-200 bg-purple-50 hover:bg-purple-100/70', borderActive: 'border-purple-500 shadow-[0_18px_38px_-28px_rgba(168,85,247,0.65)] bg-purple-50', text: 'text-purple-600 border-purple-200', surface: 'linear-gradient(135deg, #f3e8ff 0%, #fae8ff 58%, #ffffff 100%)' }
};

function PlatformLogo({ platform }) {
  if (platform.id === 'netflix') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-black border border-slate-900 shadow-md shadow-red-500/20 flex items-center justify-center p-0.5">
          <img
            src="/images/netflix.svg"
            alt="Netflix logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="leading-none">
          <div className="text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-red-600">
            NETFLIX
          </div>
          <div className="mt-1 hidden sm:block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Premium
          </div>
        </div>
      </div>
    );
  }

  if (platform.id === 'prime') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-slate-950 border border-slate-800 shadow-md shadow-cyan-500/20 flex items-center justify-center p-0.5">
          <img
            src="/images/prime.svg"
            alt="Amazon Prime logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="leading-none">
          <div className="text-[0.68rem] font-extrabold tracking-tight text-sky-600">
            prime video
          </div>
          <div className="mt-1 hidden sm:block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Amazon
          </div>
        </div>
      </div>
    );
  }

  if (platform.id === 'sonyliv') {
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-[#0a0a0f] border border-slate-800 shadow-md shadow-violet-500/25 flex items-center justify-center p-0.5">
          <img
            src="/images/sonyliv.png"
            alt="SonyLIV logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="leading-none">
          <div className="text-[0.72rem] font-extrabold tracking-tight text-slate-950">
            SonyLIV
          </div>
          <div className="mt-1 hidden sm:block text-[10px] font-bold uppercase tracking-[0.12em] text-amber-600">
            Sports + Originals
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 shadow-md shadow-fuchsia-500/20 flex items-center justify-center p-0.5">
        <img
          src="/images/zee5.svg"
          alt="Zee5 logo"
          className="w-full h-full object-contain"
        />
      </div>
      <div className="leading-none">
        <div className="text-[0.72rem] font-extrabold uppercase tracking-[0.08em] text-violet-700">
          ZEE5
        </div>
        <div className="mt-1 hidden sm:block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          Regional + Movies
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState(platformsData);
  const [selectedPlatform, setSelectedPlatform] = useState(platformsData[0]);
  const [selectedPlan, setSelectedPlan] = useState(platformsData[0].plans[2]); // Default Standard plan
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/plans');
        const data = await res.json();
        if (data.success && data.plans) {
          const updatedPlatforms = platformsData.map(plat => {
            const dbPlatformName = plat.name;
            const dbPlans = data.plans.filter(p => p.platform === dbPlatformName);
            if (dbPlans.length > 0) {
              return {
                ...plat,
                plans: dbPlans.map(dbPlan => ({
                  id: dbPlan._id,
                  name: dbPlan.name,
                  price: dbPlan.price,
                  details: dbPlan.details,
                  popular: dbPlan.popular
                })).sort((a, b) => a.price - b.price)
              };
            }
            return plat;
          });
          setPlatforms(updatedPlatforms);
          
          const currentPlat = updatedPlatforms[0];
          setSelectedPlatform(currentPlat);
          
          const standardPlan = currentPlat.plans.find(p => p.name === 'Standard') || currentPlat.plans[0];
          setSelectedPlan(standardPlan);
        }
      } catch (err) {
        console.error('Error loading pricing plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    };
    void fetchPlans();
  }, []);

  const handlePlatformChange = (platform) => {
    setSelectedPlatform(platform);
    const standardPlan = platform.plans.find(p => p.name === 'Standard') || platform.plans[0];
    setSelectedPlan(standardPlan);
  };

  const handleBuyNow = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push(`/login?redirect=checkout&platform=${selectedPlatform.name}&plan=${selectedPlan.name}&price=${selectedPlan.price}`);
      return;
    }
    router.push(`/checkout?platform=${selectedPlatform.name}&plan=${selectedPlan.name}&price=${selectedPlan.price}`);
  };

  return (
    <div className="flex flex-col gap-8 sm:gap-10 pb-24 md:pb-0">
      
      {/* Hero section */}
      <section className="text-center pt-3 pb-4 sm:py-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3.5 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] text-blue-700 shadow-sm">
          Nepal payment ready
        </div>
        <h1 className="text-[2rem] sm:text-4xl md:text-6xl font-extrabold leading-[1.08] mt-4 mb-4">
          Premium Streaming Subscriptions <br />
          <span className="bg-gradient-to-r from-blue-700 via-cyan-600 to-rose-500 bg-clip-text text-transparent">
            Activated Instantly in Nepal
          </span>
        </h1>
        <p className="text-slate-600 text-sm sm:text-base md:text-xl font-normal max-w-2xl mx-auto antialiased">
          Choose Netflix, Prime, SonyLIV, or Zee5, complete local eSewa or Khalti QR payment, and start streaming immediately.
        </p>
      </section>

      {/* Grid selection for platforms */}
      <section className="w-full">
        <h2 className="text-lg md:text-2xl font-bold mb-4 sm:mb-6 text-center text-gray-900">
          Choose your platform
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {platforms.map((platform) => {
            const isSelected = selectedPlatform.id === platform.id;
            const colors = brandColors[platform.id];
            
            return (
              <div
                key={platform.id}
                className={`group rounded-xl p-3 sm:p-4 cursor-pointer flex flex-col justify-between min-h-40 transition-all duration-200 ease-out relative overflow-hidden border shadow-[0_16px_34px_-28px_rgba(15,23,42,0.55)] ${isSelected ? colors.borderActive : `${colors.border} hover:border-slate-300`}`}
                style={{ background: colors.surface }}
                onClick={() => handlePlatformChange(platform)}
              >
                <div
                  className="absolute -right-5 top-12 z-0 pointer-events-none select-none text-[2.65rem] sm:text-[3.45rem] font-extrabold leading-none tracking-[0.02em]"
                  style={{ color: `${platform.color}10` }}
                >
                  {platform.watermarkText}
                </div>
                <div
                  className="absolute -bottom-16 -right-12 z-0 h-32 w-32 rounded-full opacity-20 blur-2xl"
                  style={{ backgroundColor: platform.color }}
                />

                {/* Light Gradient Overlay for enhanced legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-white/65 via-white/20 to-transparent z-[1] pointer-events-none" />

                {/* Gloss Glass Overlay Sheen */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.04] via-transparent to-white/[0.08] z-[1] pointer-events-none" />

                <div className="relative z-10 flex flex-col justify-between h-full w-full">
                  {/* Top Row Badge Info */}
                  <div className="flex justify-between items-start gap-3 w-full">
                    <PlatformLogo platform={platform} />
                    <span className="shrink-0 text-[8px] sm:text-[9px] px-2 py-1 rounded-full font-extrabold border transition-colors duration-300" style={{ backgroundColor: `${platform.color}16`, color: platform.color, borderColor: `${platform.color}35` }}>
                      NPR
                    </span>
                  </div>

                  {/* Bottom Row Details (Pushed down side!) */}
                  <div className="mt-auto">
                    <h3 className="text-[0.92rem] sm:text-[0.95rem] font-extrabold text-gray-950 mb-1 tracking-tight group-hover:text-blue-700 transition-colors duration-300 antialiased">{platform.name}</h3>
                    <p className="text-gray-600 text-[0.64rem] sm:text-[0.68rem] leading-relaxed max-w-[95%] font-normal antialiased">
                      {platform.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plan selection cards */}
      <section className="glass-card rounded-2xl max-w-4xl mx-auto w-full p-4 sm:p-6 md:p-8 shadow-xl border border-slate-100 bg-white">
        <h2 className="text-xl md:text-2xl font-bold mb-2 text-center text-gray-900">
          Choose your {selectedPlatform.name} tier
        </h2>
        <p className="text-slate-500 text-sm text-center mb-8">
          Select the active plan duration that matches your usage. Prices are listed in Nepalese Rupees (NPR).
        </p>

        <div className="flex flex-col gap-3 sm:gap-4">
          {selectedPlatform.plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 p-4 sm:p-5 rounded-xl transition-all duration-200 cursor-pointer border ${selectedPlan.name === plan.name ? 'border-blue-500 bg-blue-50/70 shadow-sm' : 'border-slate-100 hover:bg-slate-50 hover:border-slate-200'}`}
              onClick={() => setSelectedPlan(plan)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-6 bg-gradient-to-r from-blue-600 to-rose-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  Best Value
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="font-bold text-gray-800 text-base md:text-lg">{plan.name}</span>
                <span className="text-slate-500 text-xs md:text-sm">{plan.details}</span>
              </div>
              
              <div className="flex items-center justify-between gap-6 w-full sm:w-auto">
                <span className="font-extrabold text-blue-700 text-lg md:text-xl">
                  Rs. {plan.price}
                </span>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${selectedPlan.name === plan.name ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-transparent'}`}
                >
                  {selectedPlan.name === plan.name && (
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action area */}
        <div className="mt-10 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <p className="text-slate-500 text-xs uppercase tracking-wider">Selected Option</p>
            <p className="text-lg md:text-xl font-bold text-gray-900 mt-1">
              {selectedPlatform.name} — <span style={{ color: selectedPlatform.color }}>{selectedPlan.name}</span>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-8 w-full md:w-auto">
            <div className="text-center sm:text-right">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Total NPR</p>
              <p className="text-2xl md:text-3xl font-extrabold text-emerald-600 mt-1">
                Rs. {selectedPlan.price}
              </p>
            </div>
            <button className="btn btn-primary w-full sm:w-auto px-8 py-3.5 text-base" onClick={handleBuyNow}>
              Buy Now
            </button>
          </div>
        </div>
      </section>

      <div className="md:hidden fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_-30px_rgba(15,23,42,0.8)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Selected</p>
            <p className="truncate text-sm font-extrabold text-slate-950">
              {selectedPlatform.name} <span style={{ color: selectedPlatform.color }}>{selectedPlan.name}</span>
            </p>
            <p className="text-lg font-extrabold text-emerald-600">Rs. {selectedPlan.price}</p>
          </div>
          <button className="btn btn-primary shrink-0 px-5 py-3 text-sm" onClick={handleBuyNow}>
            Buy Now
          </button>
        </div>
      </div>

    </div>
  );
}
