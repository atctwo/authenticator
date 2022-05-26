# used for debugging chrome extension build workflow
with open("cert.pem", "r") as f:
    for c in f.read():
        print(c, end=",\n")