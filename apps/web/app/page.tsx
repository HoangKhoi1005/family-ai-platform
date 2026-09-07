import Link from 'next/link';
import { Surface } from '@family/ui';
export default function Home() {
  return (
    <main id="main" className="page">
      <header className="masthead">
        <Link href="/" className="wordmark">
          nhà mình<span aria-hidden="true">✳</span>
        </Link>
        <span className="eyebrow">GẦN NHAU HƠN MỖI NGÀY</span>
      </header>
      <div className="hero">
        <p className="eyebrow">MỘT GÓC NHỎ, DÀNH RIÊNG CHO GIA ĐÌNH</p>
        <h1>
          Những điều thân thương.
          <br />
          <em>Ở cùng một nơi.</em>
        </h1>
        <p className="intro">
          Biết thêm về người thân, nhớ những ngày quan trọng và giữ lại khoảnh khắc của cả nhà.
        </p>
        <a href="#about" className="button">
          Khám phá nhà mình <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="cards" id="about">
        <Surface>
          <span className="number">01 / BIẾT NHAU</span>
          <h2>Mỗi người, một câu chuyện</h2>
          <p>Gia phả và hồ sơ giúp các thế hệ hiểu nhau hơn, dù đang ở gần hay xa.</p>
        </Surface>
        <Surface>
          <span className="number">02 / KẾT NỐI NHAU</span>
          <h2>Việc nhà, mình cùng nhớ</h2>
          <p>Sinh nhật, ngày giỗ, bữa cơm sum họp — những dịp để cả nhà bên nhau.</p>
        </Surface>
        <Surface>
          <span className="number">03 / LƯU GIỮ NHAU</span>
          <h2>Chuyện nhỏ cũng đáng giữ</h2>
          <p>Một tấm ảnh, một lời hỏi thăm, một kỷ niệm để sau này cùng nhìn lại.</p>
        </Surface>
      </div>
      <Surface className="notice">
        <div>
          <p className="eyebrow">HẸN CẢ NHÀ SỚM NHÉ</p>
          <h2>Nhà mình đang được chuẩn bị.</h2>
          <p>
            Đây là trang giới thiệu ban đầu. Khi sẵn sàng, bạn sẽ nhận lời mời để vào không gian
            riêng của gia đình.
          </p>
        </div>
        <span className="flower" aria-hidden="true">
          ✳
        </span>
      </Surface>
      <footer>
        Family AI <span>Biết nhau · Kết nối nhau · Lưu giữ nhau</span>
      </footer>
    </main>
  );
}
