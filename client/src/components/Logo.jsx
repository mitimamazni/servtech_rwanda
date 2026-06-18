export default function Logo({ size = 36, showText = true, textClass = "" }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo.svg"
        alt="ServTech logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="flex-shrink-0"
      />
      {showText && (
        <span className={`font-semibold tracking-tight ${textClass}`}>
          <span className="text-primary-600">Serv</span>
          <span className="text-gray-800">Tech</span>
        </span>
      )}
    </div>
  );
}
