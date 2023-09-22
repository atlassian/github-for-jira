import { useState, useEffect, useRef } from "react";

const useOrgListScroll = () => {
	const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
	const [isListScrollable, setIsListScrollable] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const hasUserScrolledRef = useRef(false);

	const checkIsListScrollable = (): boolean => {
		let isListScrollable = false;
		const content = containerRef.current;
		if (content) {
			const max = parseInt(window.getComputedStyle(content).maxHeight);
			const size = content.scrollHeight;
			isListScrollable =  (size - 15) > max;
		}
		return isListScrollable;
	};

	const handleScroll = ()=> {
		const content = containerRef.current;
		hasUserScrolledRef.current = true;
		if (content) {
			const scrollTop = content.scrollTop;
			const scrollHeight = content.scrollHeight;
			const clientHeight = content.clientHeight;
			const scrolledToBottom = scrollTop + clientHeight === scrollHeight;
			setIsScrolledToBottom(scrolledToBottom);
		}
	};

	useEffect(() => {
		const content = containerRef.current;
		hasUserScrolledRef.current = false;
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
    return { isScrolledToBottom, isListScrollable, containerRef, hasUserScrolledRef };
};

export default useOrgListScroll;
