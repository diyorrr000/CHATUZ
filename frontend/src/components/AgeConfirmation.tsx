import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgeConfirmationProps {
    onConfirm: (data: { nickname: string, uid: string }) => void;
    realOnlineCount: number;
}

const AgeConfirmation: React.FC<AgeConfirmationProps> = ({ onConfirm, realOnlineCount }) => {
    const [nickname, setNickname] = useState('');
    const [showModal, setShowModal] = useState<'shartlar' | 'maxfiylik' | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (nickname.trim().length >= 3) {
            const uid = localStorage.getItem('chatuz_uid') || '';
            onConfirm({ nickname: nickname.trim(), uid });
        }
    };

    const modalContent = {
        shartlar: {
            title: "FOYDALANISH SHARTLARI",
            text: [
                "1. CHATUZ platformasidan foydalanish uchun 18 yoshdan katta bo'lishingiz shart.",
                "2. Suhbatdoshni haqorat qilish, kamsitish va behayo so'zlar ishlatish qat'iyan man etiladi.",
                "3. Har qanday turdagi reklama, spam yoki tijoriy havolalar tarqatish taqiqlanadi.",
                "4. Noqonuniy materiallar, shaxsiy ma'lumotlar va pornografik kontent ulashish taqiqlanadi.",

            ]
        },
        maxfiylik: {
            title: "MAXFIYLIK SIYOSATI",
            text: [
                "1. Sizning suhbatlaringiz to'liq anonim tarzda amalga oshiriladi va serverda saqlanmaydi.",
                "2. CHATUZ sizning shaxsiy ma'lumotlaringizni (ism, telefon, manzil) so'ramaydi va yig'maydi.",
                "3. IP manzillar faqat xavfsizlik va spamga qarshi kurashish maqsadida vaqtincha foydalaniladi.",
                "4. Yuborilgan fayllar va rasmlar faqat suhbat davomida mavjud bo'ladi.",
                "5. Biz sizning maxfiyligingizni hamma narsadan ustun qo'yamiz."
            ]
        }
    };

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

                <form onSubmit={handleSubmit} style={{ marginBottom: '30px', textAlign: 'left' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '8px', marginLeft: '4px' }}>NIKINGIZNI YOZING</label>
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Masalan: Dilshod_99"
                        required
                        minLength={3}
                        maxLength={15}
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
                            fontSize: '16px'
                        }}
                    />
                </form>

                <button
                    onClick={handleSubmit}
                    disabled={nickname.trim().length < 3}
                    style={{
                        width: '100%',
                        height: '64px',
                        background: nickname.trim().length < 3 ? '#1e293b' : '#3b82f6',
                        color: nickname.trim().length < 3 ? '#64748b' : 'white',
                        border: 'none',
                        borderRadius: '20px',
                        fontSize: '18px',
                        fontWeight: '900',
                        cursor: nickname.trim().length < 3 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    CHATNI BOSHLASH
                </button>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                    <a href="https://t.me/zafarvcd" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#3390ec', textDecoration: 'none', fontSize: '11px', fontWeight: '800', background: 'rgba(51, 144, 236, 0.05)', padding: '6px 12px', borderRadius: '10px' }}>
                        TELEGRAM
                    </a>
                    <a href="https://instagram.com/zafarvcd" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#e1306c', textDecoration: 'none', fontSize: '11px', fontWeight: '800', background: 'rgba(225, 48, 108, 0.05)', padding: '6px 12px', borderRadius: '10px' }}>
                        INSTAGRAM
                    </a>
                </div>

                <div style={{ marginTop: '30px', opacity: 0.6, fontSize: '10px' }}>
                    <p style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', color: '#94a3b8' }}>
                        @zafarvcd rasmiy sayti
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button onClick={() => setShowModal('shartlar')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>SHARTLAR</button>
                        <span style={{ color: '#475569' }}>•</span>
                        <button onClick={() => setShowModal('maxfiylik')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>MAXFIYLIK</button>
                    </div>
                </div>
            </motion.div>

            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.8)',
                            backdropFilter: 'blur(5px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 2000,
                            padding: '20px'
                        }}
                        onClick={() => setShowModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={{
                                maxWidth: '500px',
                                width: '100%',
                                background: '#1e293b',
                                borderRadius: '24px',
                                padding: '30px',
                                position: 'relative',
                                textAlign: 'left',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '20px', color: '#3b82f6' }}>
                                {modalContent[showModal].title}
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {modalContent[showModal].text.map((item, i) => (
                                    <p key={i} style={{ fontSize: '13px', lineHeight: '1.6', color: '#CBD5E1' }}>{item}</p>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowModal(null)}
                                style={{
                                    marginTop: '25px',
                                    width: '100%',
                                    height: '50px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '14px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                TUSHUNARLI
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AgeConfirmation;
