export default function Logo({ size = 'md', className = '' }) {
  return (
    <div className={`logo-diagnotest logo-diagnotest-${size} ${className}`}>
      <span className="logo-diagnotest-nombre">Diagnotest</span>
      <span className="logo-diagnotest-tagline">Confiabilidad y rapidez de respuesta</span>
    </div>
  );
}
