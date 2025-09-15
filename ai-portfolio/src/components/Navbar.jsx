// components/Navbar.jsx
import { logo } from "../assets";

const Navbar = () => {
return (
    <nav
        className="fixed top-0 w-full z-50 backdrop-blur-lg bg-white/10 border-b border-white/20
                             flex justify-between items-center px-6 py-3"
    >
        {/* Left: Logo + Name */}
        <a
            href="https://natinael-samuel.netlify.app"
            className="flex items-center gap-2"
            target="_blank"
            rel="noopener noreferrer"
        >
            <img src={logo} alt="logo" className="w-12 h-12 object-contain rounded-xl" />
            <p className="text-white text-lg sm:text-xl font-bold cursor-pointer flex items-center">
                Natinael Samuel
                <span className="ml-2 hidden sm:block text-sm font-normal text-gray-300">
                    | Software Engineer
                </span>
            </p>
        </a>

        {/* Right: Visit Portfolio */}
        <a
            href="https://natinael-samuel.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs sm:text-sm px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/40 to-pink-500/40 text-white shadow-lg border border-white/20 animate-pulse"
        >
            Visit Portfolio
        </a>
    </nav>
);
};

export default Navbar;
