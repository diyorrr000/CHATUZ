import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface UserData {
    age: string;
    country: string;
}

interface AgeConfirmationProps {
    onConfirm: (data: UserData) => void;
    realOnlineCount: number;
}

const countryGroups = [
    { label: "Global", countries: ["Dunyo bo'ylab (Global)"] },
    { label: "Markaziy Osiyo", countries: ["O'zbekiston", "Qozog'iston", "Qirg'iziston", "Tojikiston"] },
    { label: "Boshqa", countries: ["Rossiya", "Ukraina", "Turkiya", "Ozarbayjon", "Germaniya", "AQSh"] }
];

const ageRanges = ["18-24", "25-34", "35-44", "45+"];

const AgeConfirmation: React.FC<AgeConfirmationProps> = ({ onConfirm, realOnlineCount }) => {
    const [age, setAge] = useState(ageRanges[0]);
    const [country, setCountry] = useState("Dunyo bo'ylab (Global)");

    return (
        <div className="landing-overlay" style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
            zIndex: 1000,
            padding: '20px'
        }}>
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{
                    maxWidth: '450px',
                    width: '100%',
                    background: 'rgba(30, 41, 59, 0.7)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '32px',
                    padding: '40px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    color: 'white'
                }}
            >
                <div style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    borderRadius: '24px',
                    margin: '0 auto 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: '900',
                    transform: 'rotate(5deg)'
                }}>
                    UZ
                </div>

                <h1 style={{ fontSize: '42px', fontWeight: '900', margin: '0 0 10px', letterSpacing: '-2px' }}>
                    CHAT<span style={{ color: '#3b82f6' }}>UZ</span>
                </h1>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '30px',
                    fontWeight: '700',
                    fontSize: '14px',
                    color: '#10b981'
                }}>
                    <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></div>
                    <span>{realOnlineCount} foydalanuvchi onlayn</span>
                </div>

                <div style={{ marginBottom: '30px', textAlign: 'left' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', marginLeft: '4px' }}>HUDUDNI TANLANG</label>
                    <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        style={{
                            width: '100%',
                            height: '56px',
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '16px',
                            color: 'white',
                            padding: '0 16px',
                            fontWeight: '600',
                            marginBottom: '16px',
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        {countryGroups.map(group => (
                            <optgroup key={group.label} label={group.label}>
                                {group.countries.map(c => <option key={c} value={c}>{c}</option>)}
                            </optgroup>
                        ))}
                    </select>

                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', marginLeft: '4px' }}>YOSHINGIZ</label>
                    <select
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        style={{
                            width: '100%',
                            height: '56px',
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '16px',
                            color: 'white',
                            padding: '0 16px',
                            fontWeight: '600',
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        {ageRanges.map(a => <option key={a} value={a}>{a} yoshdagilar</option>)}
                    </select>
                </div>

                <button
                    onClick={() => onConfirm({ age, country })}
                    style={{
                        width: '100%',
                        height: '64px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '20px',
                        fontSize: '18px',
                        fontWeight: '900',
                        cursor: 'pointer',
                        boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
                    }}
                >
                    CHATNI BOSHLASH
                </button>

                <div style={{ marginTop: '30px', opacity: 0.5, fontSize: '11px' }}>
                    <p style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Men 18 yoshga to'lganimni tasdiqlayman
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                        <a href="#" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>SHARTLAR</a>
                        <span style={{ color: '#94a3b8' }}>•</span>
                        <a href="#" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 'bold' }}>MAXFIYLIK</a>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default AgeConfirmation;
