import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { RefreshCw } from "lucide-react";

const Captcha = forwardRef((props, ref) => {
  const [captchaText, setCaptchaText] = useState("");
  const [userInput, setUserInput] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [showError, setShowError] = useState(false);
  const canvasRef = useRef(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    verifyCaptcha: () => {
      if (!userInput.trim()) {
        setShowError(true);
        return false;
      }

      // Case-sensitive validation - must match exactly
      const verified = userInput === captchaText;
      setIsVerified(verified);
      setShowError(!verified);

      if (!verified) {
        // Generate new captcha after failed verification
        setTimeout(() => {
          generateCaptcha();
        }, 1000);
      }

      return verified;
    },
    refreshCaptcha: () => {
      generateCaptcha();
    }
  }));

  // Generate random captcha text
  const generateCaptchaText = () => {
    const chars =
      // "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // for all caps
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Draw captcha on canvas
  const drawCaptcha = (text) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Set crisp scaling
    const width = 160;
    const height = 50;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = "#f9fafb"; // light gray
    ctx.fillRect(0, 0, width, height);

    // Random lines for noise
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    // Text
    ctx.font = "bold 28px monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    for (let i = 0; i < text.length; i++) {
      const x = 20 + i * 22;
      const y = height / 2 + (Math.random() * 8 - 4); // slight vertical offset
      const rotation = (Math.random() - 0.5) * 0.4; // random rotation
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 30%)`;
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }

    // Noise dots
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  };

  // Generate new captcha
  const generateCaptcha = () => {
    const text = generateCaptchaText();
    setCaptchaText(text);
    setUserInput("");
    setIsVerified(false);
    setShowError(false);
    drawCaptcha(text);
  };

  // Clear error when user starts typing
  const handleInputChange = (e) => {
    // Filter only allowed characters (A-Z, a-z, 0-9) but keep original case
    const value = e.target.value.replace(/[^A-Za-z0-9]/g, '');
    setUserInput(value);
    if (showError) {
      setShowError(false);
    }
    // Reset verification status when input changes
    if (isVerified) {
      setIsVerified(false);
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  return (
    <div className="space-y-2 w-full">
      <label className="block text-sm font-medium text-gray-700">
        Verification Captcha
      </label>

      {/* Row: Captcha | Button | Input */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-1 w-full">
        {/* Captcha Canvas */}
        <canvas
          ref={canvasRef}
          width={160}
          height={48}
          className="rounded-lg border border-gray-300 shadow-sm bg-white h-12 w-full sm:w-auto"
        />

        {/* Refresh Button */}
        <button
          tabIndex={-1}
          type="button"
          onClick={generateCaptcha}
          className="h-12 w-full sm:w-12 flex items-center justify-center rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 transition"
          title="Refresh Captcha"
        >
          <RefreshCw className="h-5 w-7 text-gray-600" />
        </button>

        {/* Input */}
        <input
          type="text"
          value={userInput}
          onChange={handleInputChange}
          placeholder="Enter captcha"
          maxLength={6}
          className={`flex-1 h-12 px-3 py-4 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm transition-colors w-full sm:w-auto ${isVerified
            ? "border-green-300 bg-green-50"
            : showError
              ? "border-red-300 bg-red-50"
              : "border-gray-300"
            }`}
        />
      </div>

      {/* Status Messages */}
      {isVerified && (
        <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
          <span className="text-green-500">✓</span>
          Captcha verified successfully
        </p>
      )}

      {/* {showError && (
        <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
          <span className="text-red-500">✗</span>
          Incorrect captcha. Please try again.
        </p>
      )} */}
    </div>
  );



});

Captcha.displayName = 'Captcha';
export default Captcha;
