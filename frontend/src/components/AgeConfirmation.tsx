import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, User } from 'lucide-react';

interface UserData {
    age: string;
    country: string;
}

interface AgeConfirmationProps {
    onConfirm: (data: UserData) => void;
}

const countryGroups = [
    { label: "Global", countries: ["Dunyo bo'ylab (Global)"] },
    { label: "Markaziy Osiyo", countries: ["O'zbekiston", "Qozog'iston", "Qirg'iziston", "Tojikiston"] },
    { label: "Boshqa", countries: ["Rossiya", "Ukraina", "Turkiya", "Ozarbayjon", "Germaniya", "AQSh"] }
];

const ageRanges = ["18-24", "25-34", "35-44", "45+"];

const AgeConfirmation: React.FC<AgeConfirmationProps> = ({ onConfirm }) => {
    const [age, setAge] = useState(ageRanges[0]);
    const [country, setCountry] = useState("Dunyo bo'ylab (Global)");

    // Random mock online user count
    const onlineCount = "3,284";

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative max-w-lg w-full bg-[#1a3a6d]/90 backdrop-blur-2xl rounded-[40px] p-10 border border-white/20 shadow-2xl text-center overflow-hidden"
                style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}
            >
                {/* Background Decorative Circles */}
                <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>

                {/* Logo Section */}
                <div className="relative mb-8 flex justify-center">
                    <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                        <div className="w-16 h-16 border-4 border-dashed border-white/40 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                            <div className="w-3 h-3 bg-white rounded-full absolute top-1"></div>
                            <div className="w-3 h-3 bg-white rounded-full absolute bottom-1"></div>
                            <div className="w-3 h-3 bg-white rounded-full absolute left-1"></div>
                            <div className="w-3 h-3 bg-white rounded-full absolute right-1"></div>
                            <div className="w-2 h-2 bg-white/20 rounded-full"></div>
                        </div>
                    </div>
                </div>

                {/* Title & Info */}
                <h1 className="text-5xl font-black text-white mb-2 tracking-tight">CHATUZ</h1>
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></div>
                    <span className="text-sm font-bold text-white/80">{onlineCount} foydalanuvchi onlayn</span>
                </div>

                <p className="text-xl font-medium text-white mb-8">Yangi do'stlar orttiring</p>

                {/* Form Controls */}
                <div className="space-y-4 mb-10">
                    <div className="relative">
                        <select
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-12 text-white font-semibold appearance-none focus:bg-white/10 transition-all cursor-pointer"
                        >
                            {countryGroups.map(group => (
                                <optgroup key={group.label} label={group.label}>
                                    {group.countries.map(c => <option key={c} value={c}>{c}</option>)}
                                </optgroup>
                            ))}
                        </select>
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                    </div>

                    <div className="relative">
                        <select
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-12 text-white font-semibold appearance-none focus:bg-white/10 transition-all cursor-pointer"
                        >
                            {ageRanges.map(a => <option key={a} value={a}>{a} yoshdagilar</option>)}
                        </select>
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                    </div>
                </div>

                {/* Start Button */}
                <button
                    onClick={() => onConfirm({ age, country })}
                    className="w-full h-16 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-black text-xl rounded-2xl shadow-xl shadow-blue-500/20 transform transition-all active:scale-95 mb-6"
                >
                    BOSHLASH
                </button>

                {/* Footer */}
                <div className="space-y-2">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                        Men 18 yoshga to'lganimni tasdiqlayman
                    </p>
                    <div className="flex justify-center gap-4 text-[10px] text-blue-400 font-bold">
                        <a href="#" className="hover:text-blue-300">FOYDALANUVCHI SHARTNOMASI</a>
                    </div>
                    <p className="text-[11px] text-white/30 font-medium mt-4">
                        Dasturchi: <span className="text-white/50">SHONAZAROV DIYORBEK</span>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default AgeConfirmation;
