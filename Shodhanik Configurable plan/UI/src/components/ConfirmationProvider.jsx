// src/components/ConfirmationProvider.jsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToConfirm } from '@/services/ConfirmationService';

const ConfirmationProvider = () => {
    const [options, setOptions] = useState(null);

    useEffect(() => {
        const unsubscribe = subscribeToConfirm((opts) => setOptions(opts));
        return unsubscribe;
    }, []);

    const handleConfirm = () => {
        options?.resolve(true);
        setOptions(null);
    };

    const handleCancel = () => {
        options?.resolve(false);
        setOptions(null);
    };

    return (
        <AnimatePresence>
            {options && (
                <motion.div
                    className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        className="bg-white rounded-2xl p-6 w-[90%] max-w-sm shadow-lg border border-gray-200"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                    >
                        <h2 className="text-lg font-semibold text-gray-800">
                            {options?.title || 'Confirm Action'}
                        </h2>
                        <p className="text-sm text-gray-700 mt-2">
                            {options?.message || 'Are you sure you want to continue?'}
                        </p>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="px-4 py-2 text-sm rounded-md bg-gray-600 text-white hover:bg-gray-700"
                            >
                                Confirm
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ConfirmationProvider;
