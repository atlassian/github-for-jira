import { useState, useEffect, useRef } from "react";

const useOrgListScroll = () => {
	const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
	const [isListScrollable, setIsListScrollable] = useState(false);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const hasScrolledYetRef = useRef(false);

	const checkIsListScrollable = (): boolean => {
		let isListScrollable = false;
		const content = contentRef.current;
		if (content) {
			const max = parseInt(window.getComputedStyle(content).maxHeight);
			const size = content.scrollHeight;
			isListScrollable =  (size - 15) > max;
		}
		return isListScrollable;
	};

	const handleScroll = ()=> {
		const content = contentRef.current;
		hasScrolledYetRef.current = true;
		if (content) {
			const scrollTop = content.scrollTop;
			const scrollHeight = content.scrollHeight;
			const clientHeight = content.clientHeight;
			const scrolledToBottom = scrollTop + clientHeight === scrollHeight;
			setIsScrolledToBottom(scrolledToBottom);
		}
	};

	useEffect(() => {
		const content = contentRef.current;
		hasScrolledYetRef.current = false;
		if (content) {
			setIsListScrollable(checkIsListScrollable());
			content.addEventListener("scroll", handleScroll);
		}
		return () => {
			if (content) {
				content.removeEventListener("scroll", handleScroll);
			}
		};
	}, []);
    return { isScrolledToBottom, isListScrollable, contentRef, hasScrolledYetRef };
};

export default useOrgListScroll;
