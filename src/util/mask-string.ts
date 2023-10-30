const maskString = (str: string) => str[0] + str.slice(1).replace(/.(?!$)/g, "*");

export default  maskString;
