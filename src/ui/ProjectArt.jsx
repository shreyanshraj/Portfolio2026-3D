// Original illustrations for projects that have no public screenshots
// (internal tools). Plain SVG in the room's palette: no logos, no downloads.

const INK = '#2E3550'
const SAGE = '#5E7A5A'
const SUN = '#F2C14E'
const PAPER = '#F7F8F5'
const HAZE = '#CFDCE3'
const SOFT = '#9FB4C7'
const RUST = '#B5684B'

const label = { fontFamily: 'system-ui, sans-serif', fontSize: 9, fill: PAPER }
const small = { fontFamily: 'system-ui, sans-serif', fontSize: 7.5, fill: HAZE }

// Legacy records flow through the migration tool into the new platform,
// with a weekly throughput bar and a reconciliation report underneath.
export function MigrationArt() {
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="Diagram: records moving from a legacy system through a migration tool into SAP S/4HANA, with a reconciliation report">
      <rect width="320" height="200" fill="#1F2540" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(22 ${34 + i * 22})`}>
          <ellipse cx="22" cy="0" rx="22" ry="5" fill="#7C8DA6" />
          <rect x="0" y="0" width="44" height="14" fill="#6B7A94" />
          <ellipse cx="22" cy="14" rx="22" ry="5" fill="#6B7A94" />
          <ellipse cx="22" cy="0" rx="22" ry="5" fill="#8E9DB4" />
        </g>
      ))}
      <text x="44" y="112" textAnchor="middle" style={small}>Legacy systems</text>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={78 + i * 9} y={62 + (i % 2) * 6} width="6" height="4" rx="1" fill={i === 3 ? SUN : SOFT} />
      ))}
      <path d="M74 70 H120" stroke={SOFT} strokeWidth="1" strokeDasharray="2 3" />
      <path d="M118 66 l6 4 -6 4" fill="none" stroke={SOFT} strokeWidth="1.2" />
      <rect x="126" y="40" width="70" height="60" rx="8" fill={SAGE} />
      <text x="161" y="60" textAnchor="middle" style={{ ...label, fontWeight: 700 }}>Migration</text>
      <text x="161" y="71" textAnchor="middle" style={{ ...label, fontWeight: 700 }}>tool</text>
      <rect x="136" y="80" width="50" height="6" rx="3" fill="#47603F" />
      <rect x="136" y="80" width="38" height="6" rx="3" fill={SUN} />
      <text x="161" y="95" textAnchor="middle" style={{ ...small, fill: PAPER }}>1M records / week</text>
      <path d="M200 70 H238" stroke={SOFT} strokeWidth="1" strokeDasharray="2 3" />
      <path d="M236 66 l6 4 -6 4" fill="none" stroke={SOFT} strokeWidth="1.2" />
      <rect x="244" y="40" width="58" height="60" rx="8" fill="#3A4566" stroke={SOFT} strokeWidth="1" />
      <text x="273" y="60" textAnchor="middle" style={{ ...label, fontWeight: 700 }}>S/4HANA</text>
      <text x="273" y="71" textAnchor="middle" style={small}>WBS data</text>
      {/* two lines so it fits inside the box */}
      <text x="273" y="84" textAnchor="middle" style={{ ...small, fill: SUN }}>−50%</text>
      <text x="273" y="93" textAnchor="middle" style={{ ...small, fill: SUN }}>upload time</text>
      <rect x="22" y="124" width="280" height="62" rx="6" fill={PAPER} />
      <text x="32" y="138" style={{ ...label, fill: INK, fontWeight: 700 }}>Reconciliation report</text>
      {[
        ['Batch 0412', '250,000', true],
        ['Batch 0413', '250,000', true],
        ['Batch 0414', '249,996', false],
      ].map(([batch, count, ok], i) => (
        <g key={batch} transform={`translate(32 ${150 + i * 11})`}>
          <text x="0" y="0" style={{ ...small, fill: INK }}>{batch}</text>
          <text x="80" y="0" style={{ ...small, fill: INK }}>{count} records</text>
          <rect x="196" y="-7" width="64" height="9" rx="4.5" fill={ok ? SAGE : RUST} />
          <text x="228" y="0" textAnchor="middle" style={{ ...small, fill: PAPER }}>{ok ? 'Matched' : '4 flagged'}</text>
        </g>
      ))}
    </svg>
  )
}

// A camera feed with detected faces boxed, beside the serverless pipeline
// that processes the frames, and the two headline numbers.
export function CctvArt() {
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="Diagram: a CCTV frame with two faces detected, and a pipeline from cameras through a queue and serverless functions to storage">
      <rect width="320" height="200" fill="#1F2540" />
      <rect x="16" y="16" width="168" height="112" rx="6" fill="#2B3352" />
      <rect x="16" y="96" width="168" height="32" fill="#353E60" />
      <circle cx="28" cy="27" r="3" fill={RUST} />
      <text x="36" y="30" style={small}>CAM 03, live</text>
      {[
        [64, 62, 'Match 0.97', SUN],
        [132, 68, 'Unknown', SOFT],
      ].map(([x, y, tag, c]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="11" fill="#8E9DB4" />
          <path d={`M${x - 18} ${y + 40} q18 -30 36 0 z`} fill="#6B7A94" />
          <rect x={x - 15} y={y - 15} width="30" height="30" fill="none" stroke={c} strokeWidth="1.6" />
          <rect x={x - 15} y={y - 25} width="52" height="10" rx="2" fill={c} />
          <text x={x - 12} y={y - 17.5} style={{ ...small, fill: INK, fontWeight: 700 }}>{tag}</text>
        </g>
      ))}
      {[
        ['Cameras', 22],
        ['EC2', 48],
        ['SQS queue', 74],
        ['Lambda', 100],
        ['S3 results', 126],
      ].map(([name, y], i, all) => (
        <g key={name}>
          <rect x="204" y={y - 6} width="100" height="18" rx="5" fill={i === 3 ? SAGE : '#3A4566'} />
          <text x="254" y={y + 6} textAnchor="middle" style={{ ...label, fontSize: 8.5 }}>{name}</text>
          {i < all.length - 1 && <path d={`M254 ${y + 12} v8`} stroke={SOFT} strokeWidth="1.2" />}
        </g>
      ))}
      <rect x="16" y="146" width="140" height="40" rx="6" fill={PAPER} />
      <text x="28" y="164" style={{ ...label, fill: INK, fontSize: 15, fontWeight: 800 }}>500+</text>
      <text x="28" y="177" style={{ ...small, fill: INK }}>frames per minute, auto-scaling</text>
      <rect x="164" y="146" width="140" height="40" rx="6" fill={PAPER} />
      <text x="176" y="164" style={{ ...label, fill: INK, fontSize: 15, fontWeight: 800 }}>−80%</text>
      <text x="176" y="177" style={{ ...small, fill: INK }}>end-to-end latency</text>
    </svg>
  )
}

export const PROJECT_ART = { migration: MigrationArt, cctv: CctvArt }
