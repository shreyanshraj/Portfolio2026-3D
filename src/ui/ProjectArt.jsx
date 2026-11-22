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

// Two phones: a student checking in by QR code, and the volunteer's queue
// view, with the check-in time and reach underneath.
export function PantryArt() {
  const phone = (x, children) => (
    <g transform={`translate(${x} 14)`}>
      <rect width="84" height="150" rx="12" fill="#11162C" />
      <rect x="5" y="9" width="74" height="132" rx="6" fill={PAPER} />
      <rect x="32" y="3" width="20" height="3" rx="1.5" fill="#3A4566" />
      {children}
    </g>
  )
  // a decorative QR code (encodes nothing): three corner finder squares and a
  // fixed scatter of modules on a 21 x 21 grid
  const N = 21
  const finder = (r, c) => {
    for (const [fr, fc] of [[0, 0], [0, N - 7], [N - 7, 0]]) {
      const y = r - fr, x = c - fc
      if (y >= -1 && y <= 7 && x >= -1 && x <= 7) {
        if (y < 0 || y > 6 || x < 0 || x > 6) return 0
        return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4) ? 1 : 0
      }
    }
    return -1
  }
  const qr = []
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const f = finder(r, c)
    if (f === 1 || (f === -1 && ((r * 37 + c * 91 + r * c * 13) % 7) < 3)) qr.push([r, c])
  }
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="Illustration: a phone showing a QR check-in screen and another showing the pantry's check-in queue, with check-in time cut from 20 seconds to under 3">
      <rect width="320" height="200" fill="#1F2540" />
      {phone(26, (
        <>
          <text x="42" y="26" textAnchor="middle" style={{ ...label, fill: INK, fontWeight: 700 }}>Check in</text>
          <g transform="translate(18 34)">
            <rect width="48" height="48" rx="3" fill="#FFFFFF" stroke={HAZE} />
            {qr.map(([r, c]) => (
              <rect key={`${r}-${c}`} x={3 + c * 2} y={3 + r * 2} width="2.05" height="2.05" fill={INK} />
            ))}
          </g>
          <rect x="16" y="90" width="52" height="16" rx="8" fill={SAGE} />
          <text x="42" y="101" textAnchor="middle" style={{ ...small, fill: PAPER, fontWeight: 700 }}>Checked in</text>
          <text x="42" y="120" textAnchor="middle" style={{ ...small, fill: INK }}>Pickup today</text>
          <text x="42" y="131" textAnchor="middle" style={{ ...small, fontSize: 6.2, fill: '#6B7A94' }}>Survey after pickup</text>
        </>
      ))}
      {phone(124, (
        <>
          <text x="42" y="26" textAnchor="middle" style={{ ...label, fill: INK, fontWeight: 700 }}>Today</text>
          {[
            ['Student', 'In', SAGE, PAPER],
            ['Student', 'In', SAGE, PAPER],
            ['Student', 'Wait', SUN, INK],
            ['Volunteer', 'Shift', SOFT, INK],
            ['Student', 'In', SAGE, PAPER],
          ].map(([who, tag, c, t], i) => (
            <g key={i} transform={`translate(10 ${38 + i * 19})`}>
              <rect width="64" height="15" rx="3" fill="#E9EEF2" />
              <circle cx="7" cy="7.5" r="3.5" fill="#8E9DB4" />
              <text x="13.5" y="10" style={{ ...small, fontSize: 6, fill: INK }}>{who}</text>
              <rect x="45" y="3.5" width="16" height="8" rx="4" fill={c} />
              <text x="53" y="9.4" textAnchor="middle" style={{ ...small, fontSize: 4.6, fill: t, fontWeight: 700 }}>{tag}</text>
            </g>
          ))}
        </>
      ))}
      {/* numbers */}
      <rect x="222" y="22" width="84" height="52" rx="6" fill={PAPER} />
      <text x="232" y="44" style={{ ...label, fill: INK, fontSize: 14, fontWeight: 800 }}>20s → 3s</text>
      <text x="232" y="58" style={{ ...small, fill: INK }}>per check-in</text>
      <rect x="222" y="82" width="84" height="52" rx="6" fill={PAPER} />
      <text x="232" y="104" style={{ ...label, fill: INK, fontSize: 14, fontWeight: 800 }}>~500</text>
      <text x="232" y="118" style={{ ...small, fill: INK }}>students a week</text>
      <rect x="222" y="142" width="84" height="22" rx="6" fill={SAGE} />
      <text x="264" y="156" textAnchor="middle" style={{ ...small, fill: PAPER, fontWeight: 700 }}>4 campuses</text>
      <text x="160" y="188" textAnchor="middle" style={small}>React Native · TypeScript · Firebase</text>
    </svg>
  )
}

// A city street grid with cab trips traced across it (busier routes warmer),
// pickup hot spots, and an hourly demand chart beside the headline numbers.
export function CabArt() {
  const trips = [
    ['M20 150 L60 150 L60 110 L120 110 L120 60 L170 60', SUN, 2.2],
    ['M30 40 L30 80 L90 80 L90 130 L150 130 L150 170', RUST, 1.8],
    ['M180 30 L140 30 L140 90 L70 90 L70 170', SUN, 1.6],
    ['M10 100 L50 100 L50 60 L100 60 L100 20', SOFT, 1.4],
    ['M180 150 L110 150 L110 100 L40 100', SOFT, 1.4],
    ['M160 100 L160 70 L130 70 L130 40 L80 40', RUST, 1.4],
  ]
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="Illustration: cab trip trajectories traced over a city street grid with pickup hot spots, and a chart of trips by hour of day">
      <rect width="320" height="200" fill="#1F2540" />
      {/* the map */}
      <rect x="8" y="10" width="184" height="180" rx="6" fill="#2B3352" />
      {[30, 50, 70, 90, 110, 130, 150, 170].map((v) => (
        <g key={v} stroke="#3A4566" strokeWidth="1">
          <path d={`M10 ${v} H190`} />
          <path d={`M${v} 12 V188`} />
        </g>
      ))}
      <path d="M8 178 Q70 150 120 176 T192 160" stroke="#3E5A7A" strokeWidth="7" fill="none" opacity="0.8" />
      {trips.map(([d, c, w], i) => (
        <path key={i} d={d} stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" opacity="0.9" />
      ))}
      {[[120, 60, 9], [60, 110, 7], [140, 30, 6], [90, 130, 5]].map(([x, y, r]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r={r} fill={SUN} opacity="0.18" />
          <circle cx={x} cy={y} r="2.4" fill={SUN} />
        </g>
      ))}

      {/* trips by hour */}
      <text x="204" y="24" style={{ ...label, fontWeight: 700 }}>Trips by hour</text>
      {[3, 2, 1, 1, 2, 4, 7, 9, 8, 6, 6, 7, 7, 6, 6, 7, 8, 10, 9, 8, 7, 6, 5, 4].map((h, i) => (
        <rect key={i} x={204 + i * 4.5} y={86 - h * 5.5} width="3.4" height={h * 5.5} rx="1" fill={h >= 9 ? SUN : SOFT} />
      ))}
      <text x="204" y="96" style={small}>0h</text>
      <text x="310" y="96" textAnchor="end" style={small}>23h</text>

      {/* numbers */}
      <rect x="204" y="108" width="104" height="36" rx="6" fill={PAPER} />
      <text x="214" y="125" style={{ ...label, fill: INK, fontSize: 14, fontWeight: 800 }}>500K+</text>
      <text x="214" y="137" style={{ ...small, fill: INK }}>GPS records cleaned</text>
      <rect x="204" y="150" width="104" height="36" rx="6" fill={PAPER} />
      <text x="214" y="167" style={{ ...label, fill: INK, fontSize: 14, fontWeight: 800 }}>&lt; 1s</text>
      <text x="214" y="179" style={{ ...small, fill: INK }}>to explore a pattern</text>
    </svg>
  )
}

export const PROJECT_ART = { pantry: PantryArt, cab: CabArt, migration: MigrationArt, cctv: CctvArt }
