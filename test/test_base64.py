import base64

# 读取文件并进行base64编码
with open('../images/20250618153143751_www.baidu.com.png', 'rb') as f:
    encoded = base64.b64encode(f.read())

# 转为字符串（如需）
encoded_str = encoded.decode('utf-8')

# 打印或保存
print(encoded.__len__())
print("======================================================================")
print(encoded_str.__len__())
