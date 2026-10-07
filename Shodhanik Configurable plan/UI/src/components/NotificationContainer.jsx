import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, Info, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

const icons = {
    success: <CheckCircle className="text-green-600" />,
    info: <Info className="text-blue-600" />,
    warning: <AlertTriangle className="text-yellow-600" />,
    error: <XCircle className="text-red-600" />,
    loading: <Loader2 className="animate-spin text-gray-600" />,
};

const bgColors = {
    success: 'bg-green-100 border-green-300 text-green-800',
    info: 'bg-blue-100 border-blue-300 text-blue-800',
    warning: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    error: 'bg-red-100 border-red-300 text-red-800',
    loading: 'bg-gray-100 border-gray-300 text-gray-800',
};


let subscribers = [];

export const pushToast = (toast) => {
    subscribers.forEach((fn) => fn(toast));
};

const NotificationContainer = () => {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const handle = (toast) => {
            const id = Date.now();
            setToasts((prev) => [...prev, { ...toast, id }]);
            // Remove auto-close for modal behavior - user must click OK
        };
        subscribers.push(handle);
        return () => {
            subscribers = subscribers.filter((s) => s !== handle);
        };
    }, []);

    const remove = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <AnimatePresence>
            {toasts.map(({ id, type, message }) => (
                <div key={id} className="fixed inset-0 z-[9999] flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/30"
                        onClick={() => remove(id)}
                    />
                    
                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={`relative w-96 mx-4 rounded-xl shadow-2xl border ${bgColors[type] || bgColors.info}`}
                    >
                        <div className="flex items-start gap-4 p-6">
                            <div className="flex-shrink-0 mt-1">
                                {icons[type]}
                            </div>
                            <div className="flex-1">
                                <div className="text-base font-medium mb-4">{message}</div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => remove(id)}
                                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                                            type === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' :
                                            type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
                                            type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' :
                                            type === 'loading' ? 'bg-gray-600 hover:bg-gray-700 text-white' :
                                            'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                    >
                                        OK
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            ))}
        </AnimatePresence>
    );
};

export default NotificationContainer;
