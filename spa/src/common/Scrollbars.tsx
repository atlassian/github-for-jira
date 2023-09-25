/** @jsxImportSource @emotion/react */
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

// Source: https://github.com/Grsmto/simplebar/blob/master/packages/simplebar/README.md#options
const Scrollbars = ({
		style,
		children
	}: {
		style: React.CSSProperties | undefined,
		children: React.JSX.Element
	}) =>
	<SimpleBar
		forceVisible="y"
		autoHide={false}
		style={style}
	>
		{children}
	</SimpleBar>;

export default Scrollbars;
