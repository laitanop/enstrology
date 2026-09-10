export default function OracleSpinner({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 769 1113"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`oracle-spinner ${className}`}
      aria-hidden
    >
      <style>{`
        .oracle-spinner .orbit {
          transform-box: view-box;
          transform-origin: 409px 690px;
          animation: oracle-spin 2.6s linear infinite;
        }
        .oracle-spinner .sparkle {
          transform-box: fill-box;
          transform-origin: center;
          animation: oracle-twinkle 1.4s ease-in-out infinite;
        }
        .oracle-spinner .sparkle-b { animation-delay: 0.35s; }
        .oracle-spinner .sparkle-c { animation-delay: 0.7s; }
        @keyframes oracle-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes oracle-twinkle {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .oracle-spinner .orbit,
          .oracle-spinner .sparkle {
            animation: none;
          }
        }
      `}</style>

      <path d="M409 1091C578.551 1091 716 1055.18 716 1011C716 966.817 578.551 931 409 931C239.449 931 102 966.817 102 1011C102 1055.18 239.449 1091 409 1091Z" fill="#1F67B5" />
      <path d="M144 946C144 980 264 1008 409 1008C554 1008 674 980 674 946V999C674 1033 554 1061 409 1061C264 1061 144 1033 144 999V946Z" fill="#174C8B" />
      <path d="M102 1011C102 1055 240 1091 409 1091C578 1091 716 1055 716 1011V1033C716 1077 578 1113 409 1113C240 1113 102 1077 102 1033V1011Z" fill="#174C8B" />
      <path d="M409 1005C555.908 1005 675 978.585 675 946C675 913.415 555.908 887 409 887C262.092 887 143 913.415 143 946C143 978.585 262.092 1005 409 1005Z" fill="#1F67B5" />
      <path d="M409 973C578.551 973 716 846.073 716 689.5C716 532.927 578.551 406 409 406C239.449 406 102 532.927 102 689.5C102 846.073 239.449 973 409 973Z" fill="#4B1F83" />
      <path d="M209 914C209 935.287 299.566 952.817 409 952.817C518.434 952.817 609 935.287 609 914V947.183C609 968.47 518.434 986 409 986C299.566 986 209 968.47 209 947.183V914Z" fill="#1F67B5" />

      <g className="orbit">
        <path className="sparkle" d="M621 719L632 739L654 748L632 757L621 780L610 757L588 748L610 739L621 719Z" fill="#DCC9FF" />
        <path className="sparkle sparkle-b" d="M554 601L566 623L590 633L566 643L554 667L542 643L518 633L542 623L554 601Z" fill="#DCC9FF" />
        <path className="sparkle sparkle-c" d="M512 690L522 707L542 715L522 723L512 744L502 723L482 715L502 707L512 690Z" fill="#DCC9FF" />
        <path className="sparkle" d="M555 818L567 839L590 849L567 859L555 882L543 859L520 849L543 839L555 818Z" fill="#DCC9FF" />
        <path className="sparkle sparkle-b" d="M375 824L385 841L404 849L385 857L375 878L365 857L346 849L365 841L375 824Z" fill="#DCC9FF" />
        <path className="sparkle sparkle-c" d="M422 699L434 719L458 729L434 739L422 762L410 739L387 729L410 719L422 699Z" fill="#DCC9FF" />
        <path className="sparkle" d="M482 875L492 892L511 900L492 908L482 929L472 908L453 900L472 892L482 875Z" fill="#DCC9FF" />
        <path className="sparkle sparkle-b" d="M473 557L480 572L495 579L480 586L473 602L466 586L451 579L466 572L473 557Z" fill="#D9C4FF" />
        <path className="sparkle sparkle-c" d="M303 875L313 896L335 905L313 914L303 938L293 914L271 905L293 896L303 875Z" fill="#D9C4FF" />
        <path className="sparkle" d="M342 593L352 614L375 623L352 632L342 655L332 632L309 623L332 614L342 593Z" fill="#DCC9FF" />
        <path d="M555 839L621 738" stroke="#DCC9FF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M512 706L554 622L621 633" stroke="#DCC9FF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M342 613L422 720L375 839L482 892L555 839L512 706L422 720" stroke="#DCC9FF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path className="sparkle sparkle-b" d="M621 643C626.523 643 631 638.523 631 633C631 627.477 626.523 623 621 623C615.477 623 611 627.477 611 633C611 638.523 615.477 643 621 643Z" fill="#DCC9FF" />
        <path className="sparkle sparkle-c" d="M540 579C544.971 579 549 574.971 549 570C549 565.029 544.971 561 540 561C535.029 561 531 565.029 531 570C531 574.971 535.029 579 540 579Z" fill="#DCC9FF" />
        <path d="M282 674C241 681 215 712 216 745C218 789 257 813 297 804C308 802 320 797 331 790C286 796 256 766 259 726C261 703 270 687 282 674Z" fill="#DCC9FF" />
      </g>

      <path d="M46 391L60 422L92 436L60 449L46 484L32 449L0 436L32 422L46 391Z" fill="#9B5DE5" />
      <path d="M721 391L735 424L769 438L735 452L721 489L707 452L675 438L707 424L721 391Z" fill="#9B5DE5" />
      <path d="M202 60C218.569 60 232 46.5685 232 30C232 13.4315 218.569 0 202 0C185.431 0 172 13.4315 172 30C172 46.5685 185.431 60 202 60Z" fill="#4778CC" />
      <path d="M611 60C627.569 60 641 46.5685 641 30C641 13.4315 627.569 0 611 0C594.431 0 581 13.4315 581 30C581 46.5685 594.431 60 611 60Z" fill="#4778CC" />
      <path d="M407 50C267 50 169 127 169 247C169 363 261 422 406 422C551 422 644 363 644 247C644 127 547 50 407 50Z" fill="#4778CC" />
      <path d="M147 151L181 52" stroke="#4778CC" strokeWidth="16" strokeLinecap="round" />
      <path d="M663 151L629 52" stroke="#4778CC" strokeWidth="16" strokeLinecap="round" />
      <path d="M406 138C287 138 217 153 217 262C217 354 289 386 406 386C523 386 597 354 597 262C597 153 524 138 406 138Z" fill="#100B1A" />
      <path d="M141 313C164.196 313 183 275.84 183 230C183 184.16 164.196 147 141 147C117.804 147 99 184.16 99 230C99 275.84 117.804 313 141 313Z" fill="#4778CC" />
      <path d="M671 313C694.196 313 713 275.84 713 230C713 184.16 694.196 147 671 147C647.804 147 629 184.16 629 230C629 275.84 647.804 313 671 313Z" fill="#4778CC" />
      <path d="M172.978 177C148.553 209.269 142.203 260.697 165.651 297C180.306 275.824 180.794 204.227 172.978 177Z" fill="#204D91" />
      <path d="M638.5 177.5C663.5 209.5 669.5 257 645.5 293C630.5 272 630.5 204.5 638.5 177.5Z" fill="#204D91" />
      <path d="M342 243C342 229.745 331.479 219 318.5 219C305.521 219 295 229.745 295 243V272C295 285.255 305.521 296 318.5 296C331.479 296 342 285.255 342 272V243Z" fill="#36D5F2" />
      <path d="M518 243C518 229.745 507.479 219 494.5 219C481.521 219 471 229.745 471 243V272C471 285.255 481.521 296 494.5 296C507.479 296 518 285.255 518 272V243Z" fill="#36D5F2" />
      <path d="M376 323C391 345 421 345 439 323" stroke="#36D5F2" strokeWidth="17" strokeLinecap="round" />
    </svg>
  );
}
