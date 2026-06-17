# BooksLib - DevSecOps Track A

## Executive Summary

Pada pengerjaan challenge Track A ini, saya berhasil membuat pipeline jenkins yang akan mendeploy aplikasi ke sebuah Cluster Kubernetes namun hanya baru pada environment staging. Jalur komunikasi antara Kubernetes dengan Jenkins sudah dilengkapi dengan Digital Certificate sehingga komunikasi ke Jenkins maupun Kubernetes sudah dienkripsi. Challenge ini saya kerjakan dengan menggunakan empat Virtual Machine berbasis fedora core os versi 44, yang berfungsi sebagai Kubernetes Control Plane Node, Kubernetes Worker Node, Jenkins, dan Container Registry. Service Jenkins dan Container Registry saya jalankan melalui Container sehingga kesulitan yang dihadapi banyak berhubungan dengan Volume Mounts dan File Permission karena Fedora Core OS cukup ketat keamanannya. Di akhir, pipeline yang saya buat berhasil mendeploy aplikasi ke Kubernetes Cluster yang saya buat.

## 🗺️ Virtual Machine Mapping

| Node              | Address                                     | Main Function                          | Service Port                                       |
| ----------------- | ------------------------------------------- | -------------------------------------- | -------------------------------------------------- |
| Kubernetes Master | k8s-api.riq-homelab.local (192.168.109.145) | Kubernetes Control Plane               | 6443 (kube-api),10250 (kubelet),10256 (kube-proxy) |
| Kubernetes Worker | 192.168.109.143                             | Kubernetes Worker Node                 | 10250 (kubelet), 10256 (kube-proxy)                |
| Jenkins           | jenkins.riq-homelab.local                   | Jenkins Pipeline                       | 8443 (web), 50000 (jenkins-tunnel)                 |
| Harbor            | harbor.riq-homelab.local                    | Plain Docker Registry (Not harbor yet) | 5000 (registry)                                    |

# 1. Kubernetes Setup

Pada topik ini, saya akan menjajarkan langkah - langkah instalasi kubernetes mulai dari pembuatan sertifikat hingga bisa deploy pods.

## 1.1 Certificate Preparation

Sebelum mulai menginstall kubernetes, kita harus menyiapkan sertifikat digital yang akan digunakan, untuk melakukannya disini saya menggunakan OpenSSL dengan file konfigurasi sebagai berikut

- openssl-ca.cnf

```
[ req ]
default_bits        = 4096
default_md          = sha256
prompt              = no
distinguished_name  = req_distinguished_name
x509_extensions     = v3_ca

[ req_distinguished_name ]
C                   = ID
ST                  = Riau Islands
L                   = Batam
O                   = RIQ Homelab
OU                  = Infrastructure
CN                  = RIQ Homelab Root CA

[ v3_ca ]
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints       = critical, CA:true
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign

```

- openssl-kube.cnf

```
[ req ]
default_bits        = 2048
default_md          = sha256
prompt              = no
distinguished_name  = req_distinguished_name
req_extensions      = v3_req

[ req_distinguished_name ]
C                   = ID
ST                  = Riau Islands
L                   = Batam
O                   = RIQ Homelab
OU                  = CI/CD
CN                  = kubemaster.riq-homelab.local

[ v3_req ]
subjectAltName      = @alt_names
basicConstraints    = CA:FALSE
keyUsage            = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage    = serverAuth

[ alt_names ]
DNS.1 = kubemaster.riq-homelab.local
DNS.2 = kubemaster
DNS.3 = k8s-api.riq-homelab.local
DNS.4 = k8s-api
IP.1  = 192.168.109.145
IP.2  = 127.0.0.1
```

Selanjutnya generate key pair RSA untuk sertifikat CA nya, lalu lanjutkan dengan menggenerate sertifikatnya berdasarkan key yang sudah dibuat.

```
// generate key
openssl genrsa -out ca.key 4096
// generate cert
openssl req -new -x509 -key ca.key -out ca.crt -days 3650 -config openssl-ca.cnf
```

Untuk mengecek apakah sertifikanya sudah tepat, kita bisa menggunakan perintah

```
openssl x509 -in ca.crt -text -noout | grep -E "Subject:|Issuer:|Not"
```

Selanjutnya, generate pair RSA untuk sertifikat Kubernetesnya, kali ini kita menggunakan yang 2048 bit. Lalu lanjutkan dengan membuat CSR atau Certificate Signing Request yang akan ditanda tangani oleh Root CA nantinya. Lalu tanda tangani CSR nya dengan Root CA. Output dari penanda tanganan ini adalah sertifikat valid yang akan digunakan oleh kubernetes.

```
// generate key pair
openssl genrsa -out kube.key 2048

// generate CSR
openssl req -new -key kube.key -out kube.csr -config openssl-kube.cnf

// tanda tangani dengan Root CA
openssl x509 -req -in kube.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out kube.crt -days 825 -sha256 -extfile openssl-kube.cnf -extensions v3_req
```

## 1.2 Import VM

Langkah selanjutnya setelah sertifikat digital dibuat, kita harus mengimport virtual machine. Karena disini saya menggunakan Fedora Core OS, saya harus menyiapkan ignition script menggunakan butane, berikut adalah file yaml dari ignition scriptnya.

```
variant: fcos
version: 1.7.0
ignition:
  config: {}
storage:
  files:
    - path: /etc/hostname
      mode: 0644
      contents:
        inline: kubemaster-local-sn
    - path: /etc/NetworkManager/system-connections/MainInterface.nmconnection
      mode: 0600
      contents:
        inline: |
          [connection]
          id=MainInterface
          type=ethernet
          autoconnect-priority=-999
          interface-name=ens192

          [ethernet]

          [ipv4]
          address1=192.168.109.145/24
          gateway=192.168.109.2
          dns=8.8.8.8;8.8.4.4;
          dns-search=google.com;
          method=manual
    - path: /etc/sysctl.d/k8s.conf
      mode: 0644
      contents:
        inline: |
          net.bridge.bridge-nf-call-iptables  = 1
          net.bridge.bridge-nf-call-ip6tables = 1
          net.ipv4.ip_forward                 = 1
          net.ipv4.conf.all.rp_filter = 0
          net.ipv4.conf.default.rp_filter = 0
    - path: /etc/modules-load.d/k8s.conf
      mode: 0644
      contents:
        inline: |
          overlay
          br_netfilter
    - path: /etc/yum.repos.d/kubernetes.repo
      mode: 0644
      contents:
        inline: |
          [kubernetes]
          name=Kubernetes
          baseurl=https://pkgs.k8s.io/core:/stable:/v1.30/rpm/
          enabled=1
          gpgcheck=1
          gpgkey=https://pkgs.k8s.io/core:/stable:/v1.30/rpm/repodata/repomd.xml.key
passwd:
  users:
    - name: kubemaster
      groups:
        - sudo
        - wheel
      ssh_authorized_keys:
        - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKcjTbjgJPTzfM8yR0p8tUiLR8Jfr41L4y4YiEMFVZnj thori@MUHEHEHE
```

Selanjutnya untuk mengkonversinya menjadi json kita bisa menggunakan perintah butane berikut.

```
butane -s [file]
```

Outputnya akan seperti berikut ini

```
{"ignition":{"version":"3.6.0"},"passwd":{"users":[{"groups":["sudo","wheel"],"name":"kubemaster","sshAuthorizedKeys":["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKcjTbjgJPTzfM8yR0p8tUiLR8Jfr41L4y4YiEMFVZnj thori@MUHEHEHE"]}]},"storage":{"files":[{"path":"/etc/hostname","contents":{"compression":"","source":"data:,kubemaster-local-sn"},"mode":420},{"path":"/etc/NetworkManager/system-connections/MainInterface.nmconnection","contents":{"compression":"gzip","source":"data:;base64,H4sIAAAAAAAC/1SLQWrEMAxF97pL3Nq4ZUzQAbroCUIWwlYTw1gKtqYlty9TOovhw1/8/96SVYSzVZUVasFPqvIhxv2LMoOdByPbzl3YgG6m//h09Kq92olTSgnqw5iEGiPL8CkALA91BVjq8R1XoFI6j+HRp+D8+8X51+R8fHsJETYy/qHz6QpQZODF/WW+d3Rxvo/TYOp5x011u7LL2mZobLsWbCQ3usJvAAAA//+z71H93AAAAA=="},"mode":384},{"path":"/etc/sysctl.d/k8s.conf","contents":{"compression":"gzip","source":"data:;base64,H4sIAAAAAAAC/3zKsQ0CMQyF4Z4pvEAskBDdzXLyJTayZCWWMbA+TShIwWte8X+dE4/Qdud5pUupZFbUkw7jB8AGl9M/d5vw69RfV1TfZcSbosG6H1dHFyQzDN9FLTlgg/PSGws9LRfzCQAA///jC+xivAAAAA=="},"mode":420},{"path":"/etc/modules-load.d/k8s.conf","contents":{"compression":"","source":"data:,overlay%0Abr_netfilter%0A"},"mode":420},{"path":"/etc/yum.repos.d/kubernetes.repo","contents":{"compression":"gzip","source":"data:;base64,H4sIAAAAAAAC/5TMOwoCMRRG4T6LyXWwkUBW4BLEIo+fjNy8yM2Is3tRwX66w1ecG28eo2JC7qq6Anv9g/JOsI1s1zm7GKLOSTRfRD8ahTZgSKbzGYaeiz6faPRCCvVD0S4q9RRWBP4lYz80Gugtuum+UaJ+lawZu3oHAAD//xPfQCKyAAAA"},"mode":420}]}}
```

Kode tersebutlah yang akan diinputkan ke ignition code pada VMWare. Selanjutnya setelah Virtual Machine berhasil diimport, kita harus login melalui ssh. Karena Fedora Core OS pada awal instalasi hanya mengizinkan autentikasi melalui SSH dengan menggunakan SSH Public Key.
Berikut adalah perintah yang saya gunakan untuk login.

```
ssh -i "C:\Users\athkr\.ssh\id_ed25519" kubemaster@192.168.109.145
```

**Selanjutnya setelah login, saya merekomendasikan untuk merubah password dari user yang akan digunakan sehingga user tersebut bisa login langsung melalui console Virtual Machine tanpa SSH. Karena ada kemungkinan kita akan ter-lock jika terjadi kesalahan konfigurasi jaringan. Untuk mengubahnya bisa menggunakan perintah "_passwd username_" melalui root seperti pada distro linux lainnya.**

Setelah berhasil login, saya menambahkan dns machine lainnya pada file **/etc/hosts**. Hal ini perlu dilakukan karena saya tidak menggunakan dns server, sehingga untuk meresolve DNS nya diperlukan pendaftaran IP dan domain pada **/etc/hosts** (Lakukan ini di tiap machine yang akan digunakan).
Berikut adalah cara penambahannya yang paling simpel.

```
echo "192.168.109.145 k8s-api.riq-homelab.local
192.168.109.141 jenkins.riq-homelab.local
192.168.109.146 harbor.riq-homelab.local" >> /etc/hosts
```

## 1.3 Install Kubernetes

Untuk melakukan instalasi package, pada Fedora Core OS kita akan menggunakan perintah `rpm-ostree` yang setelah instalasi kita harus melakukan restart Virtual Machine untuk melakukan write ke direktori instalasinya. Hal ini harus dilakukan karena Fedora Core OS adalah Immutable OS. Dengan menggunakan Immutable OS, kerusakan sistem yang biasanya diakibatkan karena ketidak sengajaan, misalnya tidak sengaja menghapus direktori sistem bisa berkurang. Namun, dengan menggunakan Immutable OS, konfigurasi yang berhubungan dengan direktori sistem akan sulit dilakukan karena core sistem pada Immutable OS tidak bisa diubah dan bersifat Read Only.

Untuk memulai instalasi kubernetesnya kita bisa menggunakan perintah berikut,

```
rpm-ostree install kubectl kubeadm cri-o kubelet
```

Disini kita bisa langsung install, karena sebelumnya pada ignition script kita sudah mengimport repository kubernetesnya.

## 1.4 Setup Kubernetes Runtime

Untuk Runtime yang akan digunakan oleh kubernetesnya disini saya memakai standar Kubernetes yaitu CRI-O. CRI-O adalah runtime yang stabil dan menawarkan keamanan dan keringanan. Selain itu, semisal kita ingin menggunakan openshift, CRI-O adalah rekomendasi runtimenya. Maka dari itu, menurut saya CRI-O worth it dipelajari, dan challenge ini merupakan sarana implementasi yang cocok karena studi kasus yang diberikan menurut saya cukup sulit namun cocok menjadi media belajar bagi pemula seperti saya.

Pertama - tama, kita harus mengenable service CRI-O berikut adalah perintah yang bisa digunakan.

```
systemctl enable --now crio
```

Dengan mengenablekan CRIO, sebuah file bernama CRIO.sock akan digenerate pada **/var/run/crio/crio.sock**. File ini nantinya akan kita pointing ke Kubelet agar kubelet berjalan menggunakan CRIO sebagai Runtimenya.

Untuk pointingnya, kita bisa mengedit file kubelet yang ada pada **/etc/sysconfig/kubelet**. Isi awalnya harusnya seperti di bawah ini,

```
KUBELET_EXTRA_ARGS=

// ubah menjadi

KUBELET_EXTRA_ARGS=--container-runtime-endpoint=unix///var/run/crio/crio.sock
```

Lanjutkan dengan merestart service kubelet dengan perintah `systemctl restart kubelet`.

## 1.5 Move Certificate

Sebelum mulai menginisiasi Cluster, kita harus memindahkan sertifikat digital yang sudah kita buat tadi ke direktori **/etc/kubernetes/pki**. Lalu susun seperti dibawah ini,

```
/kubernetes/pki
|
|-- ca.crt
|-- ca.key
|-- front-proxy-ca.crt // copy dari file ca.crt
|-- front-proxy-ca.key // copy dari file ca.key
|-- kube.crt
\-- kube.key

/kubernetes/pki/etcd
|
|-- car.crt // copy dari file ca.crt
\-- ca.key // copy dari file ca.key
```

Setiap sertifikat harus diberikan nama yang sesuai, karena jika tidak Kubernetes akan menggenerate sertifikat baru dan tidak akan menggunakan sertifikat yang kita buat.
Selanjutnya, copy ca.crt ke direktori **/etc/pki/ca-truest/source/anchors/ca.crt**. Lalu update ca trust nya.

```
// copy ca.crt
cp ca.crt /etc/pki/ca-trust/source/anchors/riq-homelab-ca.crt
// update ca trust
update-ca-trust
```

## 1.6 Cluster Initiation

Tahap selanjutnya adalah menginisiasi Cluster, untuk melakukan ini, kita perlu menyiapkan script yaml yang akan digunakan sebagai file konfigurasinya. Berikut adalah file yang saya gunakan,

```
apiVersion: kubeadm.k8s.io/v1beta3

kind: InitConfiguration

localAPIEndpoint:
  advertiseAddress: "192.168.109.145"
  bindPort: 6443

nodeRegistration:
  name: kubemaster-local-sn // sesuaikan dengan hostname machine
  criSocket: "unix:///var/run/crio/crio.sock"
  taints:
    - effect: NoSchedule
      key: node-role.kubernetes.io/control-plane
  kubeletExtraArgs:
    node-ip: "192.168.109.145"

---

apiVersion: kubeadm.k8s.io/v1beta3

kind: ClusterConfiguration

clusterName: "riq-homelab"

controlPlaneEndpoint: "k8s-api.riq-homelab.local:6443"

certificatesDir: /etc/kubernetes/pki

networking:
  serviceSubnet: "10.96.0.0/12"
  podSubnet: "10.244.0.0/16"
  dnsDomain: cluster.local

apiServer:
  extraArgs:
    authorization-mode: "Node,RBAC"

---

apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
cgroupDriver: systemd
```

Selanjutnya untuk melakukan pengecekan kita bisa menggunakan perintah berikut ini,

```
kubeadm init --config  [file config] --dry-run
```

Dengan menjalankan perintah di atas, Kubeadm akan mensimulasikan file konfigurasi kita, sehingga kita bisa menghindari menggunakan file config yang error untuk menginisiasi Kube Cluster kita. Lalu jika sudah aman, kita bisa menghilangkan **--dry-run** nya untuk menjalankan inisiasinya.

```
kubeadm init --config kubeadm-config.yaml
```

Selanjutnya kita bisa menyalin perintah yang diberikan oleh kubernetes untuk menyimpan konfigurasi kubernetesnya pada user yang kita gunakan.

```
// jika menggunakan user biasa
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

// jika akan terus menggunakan root
export KUBECONFIG=/etc/kubernetes/admin.conf
```

Selain itu, Kubernetes juga memberikan perintah yang bisa digunakan untuk join cluster jika dijalankan di worker node. Berikut adalah contohnya.

```
kubeadm join k8s-api.riq-homelab.local:6443 --token tk0or4.49knujo37f9uryuy --discovery-token-ca-cert-hash sha256:28d7e043bfe2f70a033744308a5e96e7809b21e2a50ef154d3465944d20e9d17 -v=5
```

Namun disini saya mengalami masalah ketika menjoinkan worker ke clusternya. Nanti akan dibahas pada bagian **Debugging**

## 1.7 Setup Kubernetes Worker

Setelah Kubernetes Control Plane berhasil berjalan, langkah selanjutnya adalah melakukan setup worker node. Worker node adalah node yang digunakan untuk membuat, mengelola dan menjalankan pods pada kubernetes. Biasanya pada setup ini, Kubernetes Control Plane yang saya buat fungsinya pure untuk mengontrol saja dan tidak menyimpan apapun, ini bisa diketahui dari konfigurasi kubeadm yang menyebutkan `taints.effect: NoSchedule`. Hal ini dilakukan untuk menghindari penggunaan resource berlebih pada sisi Kubernetes Master yang bisa mengurangi efisiensi komunikasi antar machine.

Untuk setup worker kurang lebih mirip seperti kubernetes master. Namun, kita tidak menginisiasi kubeadm config, tapi menjalankan skrip join cluster seperti contoh di atas. Namun, sebelum menjalankan skripnya pastikan Worker Node sudah bisa terhubung dengan Master Nodenya. Untuk melakukannya bisa dengan melakukan **ping** maupun **curl** ke https://ip/domain_master:6443. Selain itu, jangan lupa untuk menanamkan CA Cert yang sudah kita buat ke node worker ini. Bisa dilakukan dengan copy-paste. Lalu ditutup dengan perintah `update-ca-trust`. Tahap ini diakhiri dengan berhasilnya Node Worker tergabung ke dalam cluster. Untuk mengeceknya, kita bisa menjalankan perintah berikut pada Node Masternya.

```
kubectl get nodes

// atau untuk menampilkan lebih banyak info

kubectl get nodes -o wide
```

berikut adalah contoh outputnya.

```
root@kubemaster-local-sn:/var/home/kubemaster# kubectl get nodes
NAME                  STATUS   ROLES           AGE     VERSION
kubemaster-local-sn   Ready    control-plane   3d17h   v1.30.14
kubeworker            Ready    <none>          3d16h   v1.30.14

// output wide

root@kubemaster-local-sn:/var/home/kubemaster# kubectl get nodes -o wide
NAME                  STATUS   ROLES           AGE     VERSION    INTERNAL-IP       EXTERNAL-IP   OS-IMAGE                        KERNEL-VERSION          CONTAINER-RUNTIME
kubemaster-local-sn   Ready    control-plane   3d17h   v1.30.14   192.168.109.145   <none>        Fedora CoreOS 44.20260523.3.1   7.0.9-205.fc44.x86_64   cri-o://1.32.0
kubeworker            Ready    <none>          3d16h   v1.30.14   192.168.109.143   <none>        Fedora CoreOS 44.20260523.3.1   7.0.9-205.fc44.x86_64   cri-o://1.32.0
```

Setelah Node Worker berhasil tergabung ke dalam cluster, kita bisa masuk ke tahap selanjutnya, yaitu melakukan instalasi flannel.

## 1.8 Flannel Installation

Flannel adalah sebuah CNI atau Container Network Interface yaitu semacam tools tambahan pada Kubernetes yang digunakan untuk mengontrol jaringan dari tiap objek yang berjalan di cluster ini. Pemilihan flannel disini adalah karena flannel merupakan CNI yang ringan dan tidak terlalu kompleks, sehingga cocok untuk digunakan oleh orang yang baru belajar. Namun dari segi keamanan Calico masih lebih unggul tapi dengan kompleksitas yang tinggi, karena Calico menawarkan kontrol yang lebih besar terhadap keamanan jaringan dan optimisasi performa. Dengan adanya CNI ini, pods yang nantinya akan dideploy ke Worker Node akan bisa berinteraksi dengan Master Node.

Untuk melakukan penginstalannya kita bisa menggunakan perintah berikut ini.

```
// jalankan pada master node
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
```

Lalu untuk mengecek apakah flannel sudah berjalan atau belum, kita bisa menggunakan perintah berikut.

```
kubectl get pods -n kube-flannel -o wide
```

berikut adalah contoh outputnya.

```
NAME                    READY   STATUS    RESTARTS   AGE    IP                NODE                  NOMINATED NODE   READINESS GATES
kube-flannel-ds-9jpkt   1/1     Running   7          3d3h   192.168.109.145   kubemaster-local-sn   <none>           <none>
kube-flannel-ds-c624q   1/1     Running   8          3d3h   192.168.109.143   kubeworker            <none>           <none>
```

Dapat dilihat dari output di atas, kalau Pods Flannel berjalan di kedua Node. Inilah yang membuat tiap Pod-Pod di tiap Nodenya bisa berkomunikasi.

## 1.9 Deploying First Pod

Untuk melakukan deploying pods pada kubernetes, terdapat dua cara yang saya tahu. Pertama, deskripsikan langsung pada command line. Kedua, gunakan file konfigurasi. Disini saya akan mencoba deployment dengan menggunakan file konfigurasi. Untuk melakukannya, kita perlu menyiapkan sebuah file dengan format yaml, yang isinya sesuai dengan aturan penulisan skrip kubernetes. Berikut adalah contohnya

```
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.14.2
    ports:
    - containerPort: 80
```

Kode di atas, ketika dijalankan akan membuat sebuah pod bernama nginx dengan nama container nginx menggunakan image nginx versi 1.14.2 dan membuka port 80. Berikut adalalah hasilnya ketika dijalankan.

```
root@kubemaster-local-sn:/var/home/kubemaster# kubectl apply -f simple-pod.yaml
pod/nginx created

root@kubemaster-local-sn:/var/home/kubemaster# kubectl get pods
NAME    READY   STATUS    RESTARTS   AGE
nginx   1/1     Running   0          8s
```

Dengan begitu persiapan untuk menjalankan pipeline sudah siap.

# 2. Jenkins Setup

Pada tahap topik ini, saya akan menjajarkan langkah - langkah instalasi dan konfigurasi jenkins yang saya lakukan dari awal hingga akhirnya bisa melakukan deploy aplikasi ke kubernetes. Pada tahap ini juga saya terkendala banyak masalah dan harus melakukan debugging dari pagi sampai sore :')

## 2.1 Machine Preparation

Untuk persiapan machinenya, saya melakukan hal yang kurang lebih sama seperti sebelumnya, yaitu

```
buat ignition file > import vm > compile jadi json lalu paste ignition script > install vim > reboot
```

Setelah melakukan langkah di atas saya melanjutkan dengan melakukan pendaftaran DNS pada **/etc/hosts** sehingga VM Jenkins bisa meresolve domain yang akan digunakan. Selain itu, saya juga mendaftarkan CA yang sudah dibuat. Sehingga Jenkins akan mempercayai sertifikat yang digunakan oleh VM lainnya yang menggunakan CA yang sama.

Lalu saya juga menyiapkan direktori yang akan menjadi tempat penyimpanan data utama untuk Jenkins nya. Saya membuat direktori bernama **/opt/jenkins** yang berisi direktori lain seperti **certs**, **data**, dan **logs**. Rencana saya, direktori certs akan digunakan untuk menyimpan data sertifikat yang dibutuhkan oleh jenkins, lalu direktori data akan digunakan sebagai home directory dari jenkins, lalu logs akan digunakan untuk menyimpan log (tapi tidak terealisasi).

Setelah itu, saya membuat sertifikat digital untuk jenkins menggunakan CA yang sudah dibuat sebelumnya, untuk langkah pembuatan sertifikatnya sama seperti saat membuat sertifikat kube. Yaitu dengan

```
generate key pair > generate csr > sign dengan root ca > generate pkcs file
```

Selanjutnya saya mengubah kepemilikan dari direktori **/opt/jenkins** beserta sub-direktorinya menjadi milik user jenkins (sebelumnya root) dengan perintah berikut ini.

```
chown -R jenkins:jenkins /opt/jenkins
```

Hal ini bertujuan agar jenkins bisa mengakses direktorinya untuk membuat data maupun membacanya.

## 2.2 Run Jenkins Quadlet

Jenkins pada challenge ini saya jalankan melalui Container yang dijadikan service, atau bisa disebut juga sebagai Quadlet. Berikut adalah bentuk akhir dari skrip quadlet yang saya gunakan.

```
[Unit]
Description=Jenkins CI/CD
After=network-online.target
Wants=network-online.target

[Container]
Image=harbor.riq-homelab.local:5000/jenkins-custom:2.1
ContainerName=jenkins

Network=host
Volume=/opt/bin/docker-compose:/usr/local/bin/docker-compose:ro
Volume=/opt/jenkins/data:/var/jenkins_home:Z
Volume=/opt/jenkins/certs:/var/jenkins_certs:ro,Z
Volume=/opt/jenkins/logs:/var/log/jenkins:Z
Volume=/run/user/1001/podman/podman.sock:/var/run/docker.sock:z,shared
EnvironmentFile=/opt/jenkins/jenkins.env
SecurityLabelDisable=true
User=1001

[Service]
Restart=on-failure
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
```

Seperti yang bisa dilihat dari skrip quadlet di atas, saya menggunakan image custom untuk jenkins. Hal ini dilakukan karena terdapat tools yang harus di install untuk mendukung kerja pipeline, maka dari itu saya membuat image sendiri menggunakan Dockerfile yang kemudian di upload ke Registry yang telah saya buat juga. Berikut adalah isi dari Dockerfilenya

```
FROM jenkins/jenkins:lts

USER root

RUN curl -LO "https://dl.k8s.io/release/v1.30.0/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/kubectl

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
        jq \
        bc \
        gettext-base \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
    > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y --no-install-recommends \
    docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*


ARG DOCKER_GID=1001
RUN groupadd docker
RUN groupmod -g ${DOCKER_GID} docker && usermod -aG docker jenkins

USER jenkins
```

Selanjutnya, agar jenkins menggunakan sertifikat yang sudah dibuat sebelumnya, kita harus menambahkan file env pada direktori yang sudah di definisikan pada quadletnya. Berikut adalah isi dari env yang saya gunakan.

```
root@jenkins-local:/opt/jenkins# cat jenkins.env
JENKINS_OPTS=--httpsPort=8443 --httpPort=8080 --httpsKeyStore=/var/jenkins_certs/jenkins.p12 --httpsKeyStorePassword=h0m3l4bJenKin5123
JAVA_OPTS=-Dhudson.model.DirectoryBrowserSupport.CSP=""
```

Quadlet ini nantinya akan disimpan pada direktori **/etc/containers/systemd/jenkins.container**. Setelah menyimpan lakukan reload daemon dengan perintah berikut,

```
systemctl daemon-reload

// start jenkins nya

systemctl start jenkins
```

Setelah itu, untuk memastikan kalau jenkins sudah berjalan atau belum, kita bisa menggunakan perintah `systemctl status jenkins`, berikut adalah contoh outputnya jika jenkins sudah berjalan dengan baik.

```
● jenkins.service - Jenkins CI/CD
     Loaded: loaded (/etc/containers/systemd/jenkins.container; generated)
    Drop-In: /usr/lib/systemd/system/service.d
             └─10-timeout-abort.conf
     Active: active (running) since Wed 2026-06-17 01:56:55 UTC; 5h 33min ago
 Invocation: 0022c611051f462ba90b9a3fbd67dbbf
   Main PID: 1542 (conmon)
      Tasks: 50 (limit: 4523)
     Memory: 718.2M (peak: 831M)
        CPU: 1min 56.403s
     CGroup: /system.slice/jenkins.service
             ├─libpod-payload-3327dea6436bdedf5d6e10ebda66d63847f54fa13df3948a21f073579f6092a5
             │ ├─1544 /usr/bin/tini -- /usr/local/bin/jenkins.sh
             │ └─1550 java -Duser.home=/var/jenkins_home -Dhudson.model.DirectoryBrowserSupport.CSP= -Djenkins.model.Jenkins.slaveAgentPort=50000 -Dhudson.lifecycle=hudson.lifecycle.ExitLifecycle -jar /usr/share/jenkins/jenkins.war --httpsPort=8443 --httpPort=8080 --httpsKeyStore=/var/jenkins_certs/jenkins.p12 --httpsKeyStorePassword=h0m3l4bJenKin5123
             └─runtime
               └─1542 /usr/bin/conmon --api-version 1 -c 3327dea6436bdedf5d6e10ebda66d63847f54fa13df3948a21f073579f6092a5 -u 3327dea6436bdedf5d6e10ebda66d63847f54fa13df3948a21f073579f6092a5 -r /usr/bin/crun -b /var/lib/containers/storage/overlay-containers/3327dea6436bdedf5d6e10ebda66d63847f54fa13df3948a21f073579f6092a5/userdata -p /run/containers/storage/overlay-containers/3327dea6436bdedf5d6e10ebda66d63847f54fa13df3948a21f073579f6092a5/userdata/pidfile -n jenkins --exit-dir /run/libpod/exits --persist-dir /run/libpod/persist/3327dea6436bdedf5d6e10ebda66d63847f54fa13df3948a21f073579f6092a5 --full-attach -l journald --log-level warning --syslog --runtime-arg --log-format=json --runtime-arg --log --runtime-arg=/run/containers/storage/overlay-containers/3327dea6436bdedf5d6e10ebda66d63847f54fa13df3948a21f073579f6092a5/userdata/oci-log --conmon-pidfile /run/containers/storage/overlay-containers/3327dea6436bdedf5d6e10ebda66d63847f54fa1>

Jun 17 01:57:04 jenkins-local jenkins[1542]: 2026-06-17 01:57:04.262+0000 [id=36]        INFO        jenkins.InitReactorRunner$1#onAttained: Prepared all plugins
Jun 17 01:57:04 jenkins-local jenkins[1542]: 2026-06-17 01:57:04.301+0000 [id=36]        INFO        jenkins.InitReactorRunner$1#onAttained: Started all plugins
Jun 17 01:57:04 jenkins-local jenkins[1542]: 2026-06-17 01:57:04.310+0000 [id=39]        INFO        jenkins.InitReactorRunner$1#onAttained: Augmented all extensions
Jun 17 01:57:04 jenkins-local jenkins[1542]: 2026-06-17 01:57:04.962+0000 [id=39]        INFO        h.p.b.g.GlobalTimeOutConfiguration#load: global timeout not set
Jun 17 01:57:06 jenkins-local jenkins[1542]: 2026-06-17 01:57:06.218+0000 [id=38]        INFO        jenkins.InitReactorRunner$1#onAttained: System config loaded
Jun 17 01:57:06 jenkins-local jenkins[1542]: 2026-06-17 01:57:06.221+0000 [id=39]        INFO        jenkins.InitReactorRunner$1#onAttained: System config adapted
Jun 17 01:57:06 jenkins-local jenkins[1542]: 2026-06-17 01:57:06.368+0000 [id=37]        INFO        jenkins.InitReactorRunner$1#onAttained: Loaded all jobs
Jun 17 01:57:06 jenkins-local jenkins[1542]: 2026-06-17 01:57:06.369+0000 [id=37]        INFO        jenkins.InitReactorRunner$1#onAttained: Configuration for all jobs updated
Jun 17 01:57:06 jenkins-local jenkins[1542]: 2026-06-17 01:57:06.449+0000 [id=36]        INFO        jenkins.InitReactorRunner$1#onAttained: Completed initialization
Jun 17 01:57:06 jenkins-local jenkins[1542]: 2026-06-17 01:57:06.542+0000 [id=30]        INFO        hudson.lifecycle.Lifecycle#onReady: Jenkins is fully up and running
```

Jika inisiasi baru pertama kali dilakukan, jenkins akan memberikan admin password yang bisa digunakan untuk login di halaman webnya. Namun, jika tidak berhasil menemukannya pada logs systemctl kita bisa mencarinya pada direktori data.

```
cat /opt/jenkins/data/secrets/initialAdminPassword
```

File tersebut hanya tersedia selama kita belum membuat user baru di website jenkinsnya. Setelah memasukkan password tersebut kita akan diminta untuk membuat user baru, gunakan username yang sama dengan username pada VM untuk jenkinsnya. Pada kasus ini saya menggunakan username **jenkins**.

## 2.3 Github + Jenkins

Untuk melakukan integrasi antara Jenkins dengan Github, kita harus menginstall plugin Github pada Jenkins ada dua plugin yang perlu diinstall, yaitu Github Integration Plugin dan Github Plugin.

Selanjutnya buat **Personal Access Token** pada github. Token ini akan digunakan untuk autentikasi antara Jenkins dengan Github, sehingga jenkins bisa melakukan interaksi seperti pull, membaca repo, dan membuat issue.

Kemudian pada website jenkins kita perlu membuat credentials. Navigasi ke Credentials, lalu tekan System, lalu tekan Global. Setelah itu buat credentials dengan tipe **Secret Text** berikan ID dan deskripsi (opsional) lalu simpan.

Selanjutnya pindah ke bagian Configuration dan cari bagian Github Server. Tambahkan Server dan gunakan token yang sudah dibuat pada bagian credentials nya. Sebelum menyimpan, lakukan test connection terlebih dahulu. Biasanya output akan muncul dalam bentuk **Credentials verified for user [username], rate limit 5000**

Selanjutnya saya melakukan Fork Repository dan kemudian menggenerate SSH key dari machine jenkins yang saya gunakan. Selanjutnya saya menginputkan public key yang telah dibuat ke deploy key yang ada di github. Kemudian terdapat opsi untuk memberikan izin write, namun saya tidak menyalakan izin tersebut karena dari rekomendasi yang saya lihat di google izin Read-Only sudah cukup untuk jenkins.

Selanjutnya ambil private key yang digenerate bersamaan dengan public key tadi, lalu masukkan ke credentials di jenkins dengan tipe SSH username with private key.

Selanjutnya akses virtual machine jenkins lalu gunakan perintah `ssh-keyscan github.com` untuk mendapatkan public key dari github. Selanjutnya ambil key paling bawah dan inputkan ke bagian Security pada jenkins. Kolom inputnya terdapat pada bagian `Git Host Key Verification Configuration` kemudian ubah `Host Key Verification Strategy` nya ke `Manually provided keys` lalu isi pada `Approved Host Keys`.

Selanjutnya untuk pengetesan, saya mencoba menjalankan Pipelines single branch yang kodenya adalah sebagai berikut,

```
pipeline {
    agent any

    environment {
        GITHUB_REPO = 'spexf/bookslib'
        IMAGE_NAME  = 'bookslib'
        IMAGE_TAG   = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main',
                    credentialsId: 'github-ssh-key',
                    url: 'git@github.com:spexf/bookslib.git'
            }
        }

        stage('Build') {
            steps {
                sh 'echo "Building..."'
            }
        }

        stage('Test') {
            steps {
                sh 'echo "Running tests..."'
            }
        }

    }

    post {
        success { echo 'Pipeline succeeded!' }
        failure { echo 'Pipeline failed!' }
    }
}
```

Hasilnya adalah pipeline berhasil melakukan pull repository yang akan digunakan.

```
Started by user jenkins
[Pipeline] Start of Pipeline
[Pipeline] node
Running on Jenkins in /var/jenkins_home/workspace/GIT TEST PIPELINE
[Pipeline] {
[Pipeline] withEnv
[Pipeline] {
[Pipeline] stage
[Pipeline] { (Checkout)
[Pipeline] git
The recommended git tool is: NONE
using credential github-ssh-key
 > git rev-parse --resolve-git-dir /var/jenkins_home/workspace/GIT TEST PIPELINE/.git # timeout=10
Fetching changes from the remote Git repository
 > git config remote.origin.url git@github.com:spexf/bookslib.git # timeout=10
Fetching upstream changes from git@github.com:spexf/bookslib.git
 > git --version # timeout=10
 > git --version # 'git version 2.47.3'
using GIT_SSH to set credentials Github SSH Deploy Key
[INFO] Currently running in a labeled security context
 > /usr/bin/chcon --type=ssh_home_t /var/jenkins_home/workspace/GIT TEST PIPELINE@tmp/jenkins-gitclient-ssh12752838513051571481.key
Verifying host key using manually-configured host key entries
 > git fetch --tags --force --progress -- git@github.com:spexf/bookslib.git +refs/heads/*:refs/remotes/origin/* # timeout=10
 > git rev-parse refs/remotes/origin/main^{commit} # timeout=10
Checking out Revision 8f7e1f084a1bdc8f95f5c20b0d9ecfc8fe7bca91 (refs/remotes/origin/main)
 > git config core.sparsecheckout # timeout=10
 > git checkout -f 8f7e1f084a1bdc8f95f5c20b0d9ecfc8fe7bca91 # timeout=10
 > git branch -a -v --no-abbrev # timeout=10
 > git branch -D main # timeout=10
 > git checkout -b main 8f7e1f084a1bdc8f95f5c20b0d9ecfc8fe7bca91 # timeout=10
Commit message: "jenkins trigger test"
 > git rev-list --no-walk 8f7e1f084a1bdc8f95f5c20b0d9ecfc8fe7bca91 # timeout=10
[Pipeline] }
[Pipeline] // stage
```

## 2.4 Kubernetes + Jenkins

Selanjutnya untuk mengintegrasikan Kubernetes dengan Jenkins, kita perlu menginstall kubectl pada images jenkins, inilah mengapa saya menggunakan Images Custom untuk jenkins nya.

Lalu kita pindah ke node Kubemaster, disini kita perlu membuat namespace baru untuk mendeploy aplikasinya. Untuk melakukannya kita bisa menggunakan perintah berikut ini.

```
kubectl create namespace staging
kubectl create namespace production
```

Selanjutnya kita perlu membuat beberapa file konfigurasi untuk Kubernetesnya agar jenkins dapat berjalan dengan benar.

```
apiVersion: v1
kind: ServiceAccount
metadata:
  name:  jenkins
  namespace: jenkins
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: jenkins-role
rules:
  - apiGroups: ["apps"]
    resources: ["deployments","replicasets","statefulsets","daemonsets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  - apiGroups: [""]
    resources: ["pods", "pods/log", "pods/exec"]
    verbs: ["get", "list", "watch", "create", "delete"]

  - apiGroups: [""]
    resources: ["services", "configmaps", "endpoints"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]

  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list", "create", "update", "patch", "delete"]

  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "watch"]

  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jenkins-role-binding
  namespace: staging
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: jenkins-role
subjects:
  - kind: ServiceAccount
    name: jenkins
    namespace: jenkins

---

apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jenkins-role-binding
  namespace: production
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: jenkins-role
subjects:
  - kind: ServiceAccount
    name: jenkins
    namespace: jenkins
```

Saya agak sedikit lupa mengenai file yang saya gunakan, karena pada tahap ini, saya melakukan banyak troubleshooting yang tidak terdokumentaisi.

Selanjutnya kita perlu menggenerate Kubeconfig untuk jenkinsnya, berikut adalah perintahnya.

```
// generate jenkins token
kubectl create token jenkins -n jenkins --duration=168h > jenkins-token

// ambil sertifikat CA cluster
kubectl conig view --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' | base64 -d > ca.crt

// ambil url api server lalu simpan di env var
APISERVER=$(kubectl config view -o jsonpath='{.clusters[0].cluster.server}')

// simpan token jenkins ke env var
TOKEN=$(cat jenkins-token)

// Generate kubeconfig
kubectl --kubeconfig=jenkins-kubeconfig.yaml config set-cluster riq-homelab --server=$APISERVER --certificate-authority=ca.crt --embed-certs=true

// simpan informasi user
kubectl --kubeconfig=jenkins-kubeconfig.yaml config set-credentials jenkins --token=$TOKEN

// set jenkins context dengan cluster + user
kubectl --kubeconfig=jenkins-kubeconfig.yaml config set-context jenkins-ctx --cluster=riq-homelab --user=jenkins

// gunakan context
kubectl --kubeconfig=jenkins-kubeconfig.yaml config use-context jenkins-ctx
```

Hasil akhirnya akan berupa Kubeconfig yang akan diupload ke website jenkins.

Sebelum bisa mengupload kita perlu menginstall plugin Kubernetes CLI.

Setelah itu, tambahkan file config ke credentials jenkins dengan tipe secret file.

## 2.5 Jenkins Pipeline

Pada challenge ini, saya menggunakan tools tambahan yang berfungsi untuk membantu melakukan pengecekan keamanan pada kode ketika pipeline berjalan. Tools yang pertama adalah semgrep, semgrep digunakan karena lebih lightweight dan penggunaannya cukup simpel dibandingkan tool lain seperti SonarQube yang awalnya ingin saya gunakan namun tidak jadi karena memakan lumayan banyak resource. Selanjutnya untuk pengecekan Image saya menggunakan Trivy, karena Trivy juga merupakan tool lightweight dan open source, yang mana ini sangat cocok dengan keadaan lab saya yang minim resource.

Pipeline yang saya gunakan adalah pipeline multibranch. Alur pipline dimulai dari Stage Checkout, dimana jenkins akan melakukan cloning repository ke workspace yang digunakan. Selanjutnya setelah cloning selesai, Semgrep akan melakukan scanning kode, dan jika ternyata ditemukan vuln atau cacat logika dalam kode, maka akan dicatat dan dikirim sebagai issue ke github. Selanjutnya jika Stage SAST Scanning sudah PASS, akan dilanjutkan ke building image yang kemudian image akan di push ke registry yang sudah disediakan. Kemudian Stage Image Scanning akan dimulai, Trivy akan melakukan scan image secara remote dan jika menemukan kerentanan maka akan dicatat dan dikirimkan sebagai issue ke github. Lalu jika tahap ini PASS, aplikasi akan dideploy ke kubernetes menggunakan deployment script yang sudah dibuat. Namun yang dideploy hanya branch development yang akan dideploy ke namespace staging dan main yang akan dideploy ke branch production. Selain itu, image akan dihapus begitu scanning selesai. Jika misalnya Stage SAST Scanning Fail proses akan tetap dilanjutkan hingga ke Container Scanning baru kemudian apapun hasil container scanning, hasil akhir akan tetap Fail. Tujuannya adalah agar meskipun SAST Scanning gagal, Container Scanning tetap bisa dilakukan sehingga fix issue akan bisa dilakukan secara bersamaan antara bug di kode maupun di container.

## 3. Git Branch

Untuk manajemen branch saya menggunakan git flow dengan konfigurasi sebagai berikut.
|Branch|Fungsi| Deployable?|
|---|---|---|
|main|Untuk menyimpan kode production aplikasi| Y|
|development|Untuk menyimpan kode development aplikasi| Y|
|feature|Temporary branch yang akan dihapus setelah membuat fitur| N|
|hotfix|Temporary branch yang akan dihapus setelah fix masalah| N|

## 4. Trubleshooting

Dari semua tahap, ini adalah tahap yang menghabiskan waktu paling banyak. Karena saya masih pengguna baru dari Jenkins dan Kubernetes sehingga butuh adaptasi sehingga pada challenge ini saya mengalami banyak masalah sistem mulai dari file permission, image gagal pull karena dns belum resolve, jenkins gagal deploy aplikasi karena kurang permission, jenkins agent gagal terkoneksi ke jenkins,dan yang paling bermasalah adalah aplikasi berhasil deploy namun ketika di akses dari luar cluster frontend gagal hit api dikarenakan alamat api yang tersimpan adalah yang ada didalam cluster yang tersimpan pada configmap.

## 5. Future Plan

Jika diberikan waktu lebih banyak lagi mungkin saya akan melanjutkan troubleshoot untuk masalah yang belum berhasil diselesaikan serta memperbaiki konfigurasi yang masih berantakan. Selain itu jika memiliki resource tambahan saya ingin mencoba menggunakan tool lain seperti sonarqube, menyelesaikan image registry menggunakan harbor.

Rencana saya kedepan setelah challenge ini saya submit, saya mau coba eksplorasi lagi dengan menambahkan tool checking ringan sepert OWASP Dependency Check, serta mencoba tool lain yang digunakan oleh teman - teman yang juga mengapply ke bidang yang sama.

Dalam mengerjakan challenge ini saya memanfaatkan berbagai referensi termasuk AI tools. Ke depannya saya tertarik untuk memperdalam pemahaman tentang Kubernetes lebih tepatnya mengenai manajemen jaringan dan pods pada Kubernetes, serta optimasi pipeline dengan Jenkins.

## 6. Summary

Dari mengerjakan challenge ini saya jadi sadar kalau untuk mengintegrasikan banyak aplikasi dengan teknologi yang berbeda itu sangat kompleks, sehingga dibutuhkan pemahaman untuk tiap teknologi yang digunakan untuk mempermudah dalam troubleshooting. Selain itu, karena mengerjakan challenge ini saya berhasil mengetahui apa yang harus saya pelajari selanjutnya.
