import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, StickyNote } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const chapters = [
  { id: 'ideas', label: 'Ý tưởng', title: 'Ý tưởng có chỗ ở.', body: 'Một không gian để ghi lại điều vừa nghĩ đến, gom việc cần làm và nhẹ đầu hơn mỗi ngày.', x: 230, y: 210, color: '#dcd1ed' },
  { id: 'capture', label: 'Ghi nhanh', title: 'Viết rồi để đó.', body: 'Gõ tiêu đề và nội dung. Ghi chú tự lưu, để bạn tập trung vào ý tưởng đang đến.', x: 790, y: 180, color: '#f3dfab' },
  { id: 'labels', label: 'Ngăn nắp', title: 'Mỗi ý một góc.', body: 'Gắn nhãn, ghim điều quan trọng và tìm lại trong cả tiêu đề lẫn nội dung.', x: 920, y: 570, color: '#cde0d3' },
  { id: 'reminders', label: 'Đúng lúc', title: 'Đừng quên việc hẹn.', body: 'Thêm thời gian nhắc. Việc sắp hạn chuyển vàng, quá hạn chuyển đỏ; tick khi đã xong.', x: 360, y: 650, color: '#f0cec8' },
  { id: 'begin', label: 'Bắt đầu', title: 'Một chỗ cho bạn.', body: 'Dùng ngay trên trình duyệt, hoặc tạo tài khoản để lưu ghi chú trên máy chủ. Hai không gian được giữ riêng.', x: 565, y: 410, color: '#d8d2eb' },
];

/** Original vector miniatures: no video service, remote assets or paid generation. */
function Island({ scene, x = 220, y = 180 }: { scene: number; x?: number; y?: number }) {
  const color = chapters[scene].color;
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cx="0" cy="100" rx="168" ry="48" fill="#40324e" opacity=".07" />
    <path d="M-190 8 L0 -84 190 8 0 111Z" fill={color} />
    <path d="M-190 8 L0 111 0 138 -190 35Z" fill="#bdb0ce" />
    <path d="M0 111 L190 8 190 35 0 138Z" fill="#afa1c3" />
    <g transform="translate(-115 -15) rotate(-12)">
      <path d="M0 0 145 -38 206 50 60 90Z" fill="#d4c9b9" />
      <path d="M0 -9 145 -47 206 41 60 81Z" fill="#fffdf7" />
      <path d="M145 -47 153 -18 175 -27Z" fill="#e7dece" />
      <g transform="translate(36 8) rotate(-14)">
        <text fontSize="15" fontFamily="'Be Vietnam Pro', sans-serif" fill="#44364f" fontWeight="bold">{['Ý tưởng nhỏ','Hôm nay','Học tập','Nhớ nhé','Góc của mình'][scene]}</text>
        <text y="24" fontSize="11" fontFamily="'Be Vietnam Pro', sans-serif" fill="#6f617a">{['Một ngày rõ ràng hơn','Ghi lại điều vừa nghĩ','Project cuối kỳ','Nộp bản demo','Viết xuống, nhẹ đầu'][scene]}</text>
      </g>
    </g>
    {scene === 0 && <g transform="translate(65 -80)"><path d="M-28 -8 Q-60 -80 0 -86 Q61 -80 29 -8 L17 11 -16 11Z" fill="#f1d68a" /><path d="M-16 12 H18 V29 H-16Z" fill="#786489" /><path d="M-9 31 H10" stroke="#59436d" strokeWidth="7" /><path d="M-60 -66 -75 -78 M62 -64 78 -75 M0 -106 V-124" stroke="#d9b45c" strokeWidth="5" strokeLinecap="round" /></g>}
    {scene === 1 && <g transform="translate(87 -35) rotate(-25)"><path d="M0 0 H18 V-115 H0Z" fill="#796092" /><path d="M0 -115 H18 V-134 H0Z" fill="#d8b896" /><path d="M0 0 9 23 18 0Z" fill="#d8b896" /><path d="M6 16 9 23 12 16Z" fill="#44364f" /><path d="M3 -111 V-7" stroke="#a48aba" strokeWidth="3" /></g>}
    {scene === 2 && <g transform="translate(55 -98)"><path d="M-25 15 39 -9 98 36 34 62Z" fill="#5e866c" /><path d="M-25 15 V42 L34 88 98 61 V36 L34 62Z" fill="#94b59e" /><path d="M-16 -6 49 -30 107 15 42 41Z" fill="#c5dfcd" /><text x="5" y="16" fontSize="13" fill="#365343" fontFamily="'Be Vietnam Pro', sans-serif" transform="rotate(12)">Project</text></g>}
    {scene === 3 && <g transform="translate(45 -124)"><path d="M-35 15 64 -3 91 96 -9 115Z" fill="#b76965" /><path d="M-35 0 64 -18 91 81 -9 100Z" fill="#fff4e6" /><path d="M-35 0 64 -18 70 6 -28 24Z" fill="#cb8076" /><path d="M0 46 15 58 43 24" fill="none" stroke="#855854" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><path d="M-15 -14 V10 M40 -24 V0" stroke="#69516e" strokeWidth="6" strokeLinecap="round" /></g>}
    {scene === 4 && <g transform="translate(60 -120)"><path d="M-30 0 60 -16 88 92 -2 108Z" fill="#76608c" /><path d="M-23 5 54 -8 76 79 0 94Z" fill="#e9e0f2" /><path d="M-5 35 15 52 45 15" fill="none" stroke="#947aaa" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="34" cy="88" r="4" fill="#b9a9c9" /></g>}
    <g transform="translate(-96 40)"><path d="M0 0 36 -12 62 12 25 26Z" fill="#957eaa" /><path d="M0 0 V14 L25 39 62 25 V12 L25 26Z" fill="#c3afd1" /></g>
    <path d="M113 56 136 49 149 61 126 69Z" fill="#f8efde" />
  </g>;
}

export function WelcomePage() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => { document.title = 'ghi chú. — Ý tưởng có chỗ ở'; }, []);
  useGSAP(() => {
    if (!root.current || !track.current || !camera.current || typeof window.matchMedia !== 'function') return;
    gsap.registerPlugin(ScrollTrigger);
    const element = root.current;
    const media = gsap.matchMedia();
    media.add('(min-width: 861px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)', () => {
      element.classList.add('flight-ready');
      const target = camera.current!;
      const pose = (index: number, scale: number) => ({ scale, x: (550-chapters[index].x)*scale, y: (410-chapters[index].y)*scale });
      gsap.set(target,{...pose(0,1), xPercent:-50, yPercent:-50});
      const timeline = gsap.timeline({ scrollTrigger: {
        trigger: track.current, start: 'top top', end: 'bottom bottom', scrub: 0.7,
        invalidateOnRefresh: true,
      }, onUpdate() {
        const next = Math.min(chapters.length-1,Math.floor(this.progress()*chapters.length));
        setActive(current => current === next ? current : next);
      } });
      chapters.forEach((_,index) => {
        timeline.to(target,{...pose(index,1.12), rotation: index % 2 ? 3 : -3, duration:0.65,ease:'sine.inOut'});
        timeline.to(target,{duration:0.35});
        if(index < chapters.length-1) timeline.to(target,{...pose(index+1,0.65),rotation:0,duration:0.3,ease:'sine.inOut'});
      });
      return () => { element.classList.remove('flight-ready'); };
    }, root);
    return () => media.revert();
  },{scope:root});

  function jump(event: MouseEvent<HTMLAnchorElement>,index: number) {
    if (!root.current?.classList.contains('flight-ready') || !track.current) return;
    event.preventDefault();
    const area = track.current;
    window.scrollTo({top:window.scrollY+area.getBoundingClientRect().top+(area.offsetHeight-window.innerHeight)*(index+0.15)/chapters.length,behavior:'smooth'});
  }
  return <main ref={root} className="welcome-page">
    <a className="welcome-skip" href="#welcome-start">Bỏ qua phần giới thiệu</a>
    <header className="welcome-header"><Link to="/welcome" className="welcome-brand" aria-label="ghi chú. — Trang giới thiệu"><StickyNote size={25} />ghi chú.</Link>
      <nav aria-label="Điều hướng giới thiệu"><Link to="/login">Đăng nhập</Link><Link to="/register">Tạo tài khoản</Link><Link to="/guest" className="welcome-try">Dùng thử <ArrowRight size={16} /></Link></nav></header>
    <div ref={track} className="welcome-track"><div className="welcome-stage">
      <div className="world-visual" aria-hidden="true"><div ref={camera} className="world-camera"><svg viewBox="0 0 1100 900">
        <path d="M230 210 Q500 -80 790 180 T920 570 Q650 870 360 650 T565 410" fill="none" stroke="#c5b5d5" strokeWidth="7" strokeDasharray="2 23" strokeLinecap="round" />
        {chapters.map((chapter,index)=><g key={chapter.id} className={`world-island ${active===index?'is-active':''}`}><Island scene={index} x={chapter.x} y={chapter.y}/></g>)}
      </svg></div></div>
      <div className="world-copy">{chapters.map((chapter,index)=><section key={chapter.id} id={chapter.id} className={`world-chapter ${active===index?'is-active':''}`}>
        <div className="chapter-words">{index===0?<h1>{chapter.title}</h1>:<h2>{chapter.title}</h2>}<p>{chapter.body}</p>
          {index===0&&<Link to="/guest" className="welcome-action">Bắt đầu ghi chú <ArrowRight size={19}/></Link>}
          {index===4&&<Link to="/register" className="welcome-action">Tạo góc riêng <ArrowRight size={19}/></Link>}
          {index===0&&<span className="welcome-scroll"><ArrowDown size={17}/>Cuộn để ghé từng góc nhỏ</span>}
        </div>
        <svg className="chapter-art" viewBox="0 0 440 350" aria-hidden="true"><Island scene={index}/></svg>
      </section>)}</div>
      <nav className="world-route" aria-label="Hành trình ghi chú">{chapters.map((chapter,index)=><a key={chapter.id} href={`#${chapter.id}`} aria-current={active===index?'step':undefined} onClick={event=>jump(event,index)}>{chapter.label}</a>)}</nav>
    </div></div>
    <footer id="welcome-start" className="welcome-finale"><h2>Ghi lại. Nhẹ đầu hơn.</h2><p>Không cần tài khoản để bắt đầu. Nếu muốn lưu trên máy chủ, bạn có thể tạo một góc riêng.</p><div><Link className="welcome-action" to="/guest">Mở ghi chú trên máy <ArrowRight size={19}/></Link><Link to="/register">Đăng ký tài khoản</Link></div><span>ghi chú.</span></footer>
  </main>;
}
